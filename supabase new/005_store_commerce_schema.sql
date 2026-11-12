-- ════════════════════════════════════════════════════════════════════════
-- 005 — BB Store: Commerce Schema (Cart, Orders, Payments, Delivery,
--        Wishlist, Offers, Settings, Inventory Automation)
-- Depends on: 001_extensions_and_shared_functions.sql,
--             004_store_catalog_schema.sql (store_products, store_product_variants)
--
-- CONSOLIDATION NOTE — final-state determination:
--   store_orders.payment_method's CHECK constraint was originally
--   ('cod','upi','card','netbanking') in 005_store_orders.sql, then
--   widened by 011_razorpay_and_delivery.sql (DROP + ADD CONSTRAINT) to
--   ('razorpay','upi','card','netbanking','wallet','emi','cod','other').
--   Only the FINAL, widened constraint is reproduced below, applied
--   directly in the CREATE TABLE — no intermediate DROP/ADD dance is
--   needed on a fresh install.
--
--   store_product_variants gained a second, functionally-identical admin
--   RLS policy in 006_inventory_automation.sql ("Admins manage variants")
--   on top of the one already created in 004 ("store_variants_admin_all").
--   Only one is kept — see 007_store_security_rls.sql and
--   CONSOLIDATION_REPORT.md, "Removed redundancies".
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. CART
-- ════════════════════════════════════════════════════════════════════════

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
create unique index if not exists store_cart_items_user_variant_idx
  on public.store_cart_items (user_id, variant_id);
create index if not exists store_cart_items_user_idx
  on public.store_cart_items (user_id);

drop trigger if exists store_cart_items_updated_at on public.store_cart_items;
create trigger store_cart_items_updated_at
  before update on public.store_cart_items
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 2. ORDERS
-- Delivery address + customer details are stored as JSON snapshots so
-- order history stays accurate even if the user later edits their profile
-- or a product is edited/removed.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,          -- human-readable: BB-2024-00001
  user_id           uuid not null references auth.users(id) on delete restrict,

  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text not null default '',

  delivery_address  jsonb not null default '{}',   -- { line1, line2, city, state, pincode, country }

  -- 'razorpay' is a transient value used between order-creation and
  -- payment confirmation; 'cod' is kept only for backward compatibility
  -- with historical rows — the checkout UI no longer offers it.
  payment_method    text not null default 'cod'
                    check (payment_method in ('razorpay','upi','card','netbanking','wallet','emi','cod','other')),
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_reference text,

  -- Razorpay identifiers (011_razorpay_and_delivery.sql)
  razorpay_order_id   text,
  razorpay_payment_id text,
  razorpay_signature  text,
  payment_error       text,

  subtotal_paise    bigint not null default 0,
  discount_paise    bigint not null default 0,
  delivery_paise    bigint not null default 0,
  total_paise       bigint not null default 0,

  -- placed → confirmed → processing → shipped → delivered; any state can
  -- transition to cancelled.
  status            text not null default 'placed'
                    check (status in ('placed','confirmed','processing','shipped','delivered','cancelled')),

  notes             text not null default '',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists store_orders_user_idx     on public.store_orders (user_id);
create index if not exists store_orders_status_idx   on public.store_orders (status);
create index if not exists store_orders_created_idx  on public.store_orders (created_at desc);

-- Idempotency: a Razorpay order/payment id must map to at most one of our
-- orders. Partial unique indexes so multiple NULLs are allowed.
create unique index if not exists store_orders_razorpay_order_id_uidx
  on public.store_orders (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists store_orders_razorpay_payment_id_uidx
  on public.store_orders (razorpay_payment_id) where razorpay_payment_id is not null;

drop trigger if exists store_orders_updated_at on public.store_orders;
create trigger store_orders_updated_at
  before update on public.store_orders
  for each row execute procedure public.set_updated_at();

do $$ begin alter publication supabase_realtime add table public.store_orders; exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. ORDER ITEMS
-- Product/pricing details are snapshotted at purchase time so order
-- history stays accurate even if the product is later edited or removed.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.store_orders(id) on delete cascade,

  product_id      uuid references public.store_products(id) on delete set null,
  variant_id      uuid references public.store_product_variants(id) on delete set null,

  product_name    text not null,
  variant_name    text not null default '',
  sku             text not null default '',
  image_url       text,

  unit_price_paise   bigint not null,
  compare_price_paise bigint,
  quantity           int not null check (quantity > 0),
  line_total_paise   bigint not null,

  created_at      timestamptz not null default now()
);

create index if not exists store_order_items_order_idx   on public.store_order_items (order_id);
create index if not exists store_order_items_product_idx on public.store_order_items (product_id);

-- ── Order number sequence + generator ─────────────────────────────────
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

-- Server-only (src/app/api/store/checkout/create-order/route.ts) — never
-- called from the browser.
revoke execute on function public.generate_order_number() from public, anon, authenticated;
grant execute on function public.generate_order_number() to service_role;

-- ════════════════════════════════════════════════════════════════════════
-- 4. INVENTORY AUTOMATION
-- ════════════════════════════════════════════════════════════════════════

-- Deduct stock when an order item is placed; flip to out_of_stock at 0.
create or replace function public.deduct_inventory_on_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.store_product_variants
  set
    stock_quantity   = greatest(0, stock_quantity - NEW.quantity),
    availability     = case
                         when greatest(0, stock_quantity - NEW.quantity) = 0
                         then 'out_of_stock'
                         else availability
                       end,
    updated_at       = now()
  where id = NEW.variant_id;

  return NEW;
end;
$$;

drop trigger if exists trg_deduct_inventory on public.store_order_items;
create trigger trg_deduct_inventory
  after insert on public.store_order_items
  for each row
  when (NEW.variant_id is not null)
  execute procedure public.deduct_inventory_on_order();

-- Restore stock when an order transitions to 'cancelled'.
create or replace function public.restore_inventory_on_cancel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.status = 'cancelled' and OLD.status != 'cancelled' then
    update public.store_product_variants v
    set
      stock_quantity = v.stock_quantity + oi.quantity,
      availability   = case
                         when v.availability = 'out_of_stock'
                         then 'active'
                         else v.availability
                       end,
      updated_at     = now()
    from public.store_order_items oi
    where oi.order_id = NEW.id
      and oi.variant_id = v.id;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_restore_inventory_cancel on public.store_orders;
create trigger trg_restore_inventory_cancel
  after update on public.store_orders
  for each row
  execute procedure public.restore_inventory_on_cancel();

-- ════════════════════════════════════════════════════════════════════════
-- 5. RAZORPAY WEBHOOK EVENTS — idempotency ledger
-- Records each processed webhook event id so retried/duplicate webhook
-- deliveries from Razorpay never double-apply a payment update. No
-- client-side access at all — only the server (service role) touches
-- this table.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_razorpay_events (
  event_id    text primary key,
  event_type  text not null default '',
  received_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 6. STORE DELIVERY PROFILES
-- Saved delivery details for BB Store checkout only — completely separate
-- from BB Health profile data. Structured to allow multiple saved
-- addresses (is_default flag + label).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_delivery_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  recipient_name        text not null default '',
  phone                 text not null default '',
  line1                 text not null default '',
  line2                 text not null default '',
  city                  text not null default '',
  state                 text not null default '',
  pincode               text not null default '',
  country               text not null default 'India',
  delivery_instructions text not null default '',

  -- 014_wishlist_and_addresses.sql: short user-facing name for this saved
  -- address, e.g. Home, Work, Parents place.
  label                 text not null default 'Home',

  is_default            boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists store_delivery_profiles_user_idx
  on public.store_delivery_profiles (user_id);

comment on column public.store_delivery_profiles.label is
  'Short user-facing name for this saved address, e.g. Home, Work, Parents place.';

drop trigger if exists store_delivery_profiles_updated_at on public.store_delivery_profiles;
create trigger store_delivery_profiles_updated_at
  before update on public.store_delivery_profiles
  for each row execute procedure public.set_updated_at();

-- Enforce a single default address per user via trigger (rather than a
-- bare partial unique index) so the API can insert/update a row with
-- is_default = true without first hunting down and clearing the previous
-- default in a separate round trip.
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

-- Backfill (idempotent, no-op on a fresh project): if a user somehow ended
-- up with more than one default row (pre-trigger data), keep only the
-- most recently updated one.
with ranked as (
  select id, row_number() over (
    partition by user_id order by updated_at desc, created_at desc
  ) as rn
  from public.store_delivery_profiles
  where is_default
)
update public.store_delivery_profiles p
  set is_default = false
  from ranked r
  where p.id = r.id and r.rn > 1;

-- ════════════════════════════════════════════════════════════════════════
-- 7. WISHLIST
-- One row per (user, product) — product-level, not variant-level.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.store_products(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create unique index if not exists store_wishlist_items_user_product_uidx
  on public.store_wishlist_items (user_id, product_id);
create index if not exists store_wishlist_items_user_idx
  on public.store_wishlist_items (user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 8. OFFERS
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_offers (
  id              uuid primary key default gen_random_uuid(),

  title           text not null,
  code            text unique,
  description     text not null default '',

  discount_type   text not null default 'percentage'
                    check (discount_type in ('percentage', 'fixed_paise')),
  discount_value  numeric not null,

  is_active       boolean not null default true,
  starts_at       timestamptz,
  ends_at         timestamptz,

  -- empty = sitewide; populated = specific products only
  product_ids     uuid[] not null default '{}',

  min_order_paise numeric,
  max_uses        int,
  used_count      int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists store_offers_active_idx  on public.store_offers (is_active);
create index if not exists store_offers_code_idx    on public.store_offers (code);

drop trigger if exists trg_offers_updated_at on public.store_offers;
create trigger trg_offers_updated_at
  before update on public.store_offers
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 9. STORE SETTINGS
-- Key-value store for admin-controlled settings. Table only — seed
-- defaults live in 009_seed_and_configuration.sql.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);
