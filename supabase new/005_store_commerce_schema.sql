-- ════════════════════════════════════════════════════════════════════════
-- 005 — BB Store: commerce schema
-- Depends on: 001, 004 (store_products, store_product_variants)
--
--   store_cart_items          per-user cart
--   store_orders / _items     orders with price/address snapshots
--   store_razorpay_events     webhook idempotency ledger
--   store_delivery_profiles   saved addresses (store-only, not BB Health)
--   store_wishlist_items      per-user wishlist
--   store_offers              discount codes / promotions
--   store_settings            admin-controlled key/value settings
--   admin_audit_log           admin login/action events
--
-- Stock deduction, cancellation restore and order expiry are in 006.
-- Policies are in 007.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Cart ─────────────────────────────────────────────────────────────
create table if not exists public.store_cart_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.store_products(id) on delete cascade,
  variant_id  uuid not null references public.store_product_variants(id) on delete cascade,
  quantity    int not null default 1 check (quantity > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- One cart line per user + variant
create unique index if not exists store_cart_items_user_variant_idx on public.store_cart_items (user_id, variant_id);
create index        if not exists store_cart_items_user_idx         on public.store_cart_items (user_id);

drop trigger if exists store_cart_items_updated_at on public.store_cart_items;
create trigger store_cart_items_updated_at before update on public.store_cart_items
  for each row execute procedure public.set_updated_at();

-- ── 2. Orders ───────────────────────────────────────────────────────────
-- Customer details and the delivery address are JSON/text snapshots, so
-- history stays correct even if the profile or product is later edited.
create table if not exists public.store_orders (
  id                   uuid primary key default gen_random_uuid(),
  order_number         text not null unique,            -- BB-2026-00001
  user_id              uuid not null references auth.users(id) on delete restrict,

  customer_name        text not null,
  customer_email       text not null,
  customer_phone       text not null default '',
  delivery_address     jsonb not null default '{}',     -- { line1, line2, city, state, pincode, country }

  -- 'razorpay' is transient between order creation and payment confirmation;
  -- 'cod' is kept only for historical rows (checkout no longer offers it).
  payment_method       text not null default 'cod'
                       check (payment_method in ('razorpay','upi','card','netbanking','wallet','emi','cod','other')),
  payment_status       text not null default 'pending'
                       check (payment_status in ('pending','paid','failed','refunded')),
  payment_reference    text,
  razorpay_order_id    text,
  razorpay_payment_id  text,
  razorpay_signature   text,
  payment_error        text,

  subtotal_paise       bigint not null default 0,
  discount_paise       bigint not null default 0,
  delivery_paise       bigint not null default 0,
  total_paise          bigint not null default 0,

  -- placed → confirmed → processing → shipped → delivered; any state → cancelled
  status               text not null default 'placed'
                       check (status in ('placed','confirmed','processing','shipped','delivered','cancelled')),
  notes                text not null default '',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists store_orders_user_idx    on public.store_orders (user_id);
create index if not exists store_orders_status_idx  on public.store_orders (status);
create index if not exists store_orders_created_idx on public.store_orders (created_at desc);

-- A Razorpay order/payment id maps to at most one of our orders (NULLs allowed).
create unique index if not exists store_orders_razorpay_order_id_uidx
  on public.store_orders (razorpay_order_id)   where razorpay_order_id   is not null;
create unique index if not exists store_orders_razorpay_payment_id_uidx
  on public.store_orders (razorpay_payment_id) where razorpay_payment_id is not null;

drop trigger if exists store_orders_updated_at on public.store_orders;
create trigger store_orders_updated_at before update on public.store_orders
  for each row execute procedure public.set_updated_at();

-- ── 3. Order items (price/product snapshot at purchase time) ────────────
create table if not exists public.store_order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.store_orders(id) on delete cascade,
  product_id           uuid references public.store_products(id)         on delete set null,
  variant_id           uuid references public.store_product_variants(id) on delete set null,

  product_name         text not null,
  variant_name         text not null default '',
  sku                  text not null default '',
  image_url            text,

  unit_price_paise     bigint not null,
  compare_price_paise  bigint,
  quantity             int not null check (quantity > 0),
  line_total_paise     bigint not null,
  created_at           timestamptz not null default now()
);

create index if not exists store_order_items_order_idx   on public.store_order_items (order_id);
create index if not exists store_order_items_product_idx on public.store_order_items (product_id);

-- ── 4. Order numbers ────────────────────────────────────────────────────
create sequence if not exists store_order_number_seq start 1 increment 1;

create or replace function public.generate_order_number()
returns text
language plpgsql
set search_path = public
as $$
begin
  return 'BB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('store_order_number_seq')::text, 5, '0');
end;
$$;

-- Called only by POST /api/store/checkout/create-order (service role).
revoke execute on function public.generate_order_number() from public, anon, authenticated;
grant  execute on function public.generate_order_number() to service_role;

-- ── 5. Razorpay webhook ledger ──────────────────────────────────────────
-- Each processed event id is recorded so retried webhooks never double-apply.
-- Server-only: RLS on, no policies.
create table if not exists public.store_razorpay_events (
  event_id     text primary key,
  event_type   text not null default '',
  received_at  timestamptz not null default now()
);

-- ── 6. Saved delivery addresses ─────────────────────────────────────────
create table if not exists public.store_delivery_profiles (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  label                  text not null default 'Home',   -- Home, Work, Parents place…
  recipient_name         text not null default '',
  phone                  text not null default '',
  line1                  text not null default '',
  line2                  text not null default '',
  city                   text not null default '',
  state                  text not null default '',
  pincode                text not null default '',
  country                text not null default 'India',
  delivery_instructions  text not null default '',
  is_default             boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists store_delivery_profiles_user_idx on public.store_delivery_profiles (user_id);

drop trigger if exists store_delivery_profiles_updated_at on public.store_delivery_profiles;
create trigger store_delivery_profiles_updated_at before update on public.store_delivery_profiles
  for each row execute procedure public.set_updated_at();

-- At most one default address per user. A trigger (not a partial unique
-- index) lets the API save a new default in one round trip: the previous
-- default is cleared automatically.
create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default then
    update public.store_delivery_profiles
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists store_delivery_profiles_single_default on public.store_delivery_profiles;
create trigger store_delivery_profiles_single_default
  before insert or update of is_default on public.store_delivery_profiles
  for each row
  when (new.is_default)
  execute procedure public.enforce_single_default_address();

-- ── 7. Wishlist (product-level) ─────────────────────────────────────────
create table if not exists public.store_wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.store_products(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create unique index if not exists store_wishlist_items_user_product_uidx on public.store_wishlist_items (user_id, product_id);
create index        if not exists store_wishlist_items_user_idx         on public.store_wishlist_items (user_id);

-- ── 8. Offers ───────────────────────────────────────────────────────────
create table if not exists public.store_offers (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  code             text unique,
  description      text not null default '',
  discount_type    text not null default 'percentage' check (discount_type in ('percentage','fixed_paise')),
  discount_value   numeric not null,
  is_active        boolean not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  product_ids      uuid[] not null default '{}',   -- empty = sitewide; otherwise only these products
  min_order_paise  numeric,
  max_uses         int,
  used_count       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists store_offers_active_idx on public.store_offers (is_active);

drop trigger if exists trg_offers_updated_at on public.store_offers;
create trigger trg_offers_updated_at before update on public.store_offers
  for each row execute procedure public.set_updated_at();

-- ── 9. Store settings (key/value; defaults seeded in 009) ───────────────
create table if not exists public.store_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- ── 10. Admin audit log ─────────────────────────────────────────────────
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users(id) on delete set null,
  event_type  text not null,                  -- 'login' | 'logout' | 'action'
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_log_admin_idx   on public.admin_audit_log (admin_id);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

-- ── 11. Realtime ────────────────────────────────────────────────────────
do $$ begin alter publication supabase_realtime add table public.store_orders; exception when duplicate_object then null; end $$;
