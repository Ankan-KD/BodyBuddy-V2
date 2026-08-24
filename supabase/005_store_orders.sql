-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 7: Orders Schema
-- Run this in your Supabase SQL editor AFTER cart_schema.sql.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. ORDERS
-- Each placed order is one row. Delivery address + customer details are
-- stored as JSON so we capture the exact values at order time (even if
-- the user later updates their profile). Pricing snapshot is also stored.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text not null unique,          -- human-readable: BB-2024-00001
  user_id           uuid not null references auth.users(id) on delete restrict,

  -- ── Customer details snapshot (at order time) ─────────────────────
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text not null default '',

  -- ── Delivery address (JSON snapshot) ─────────────────────────────
  delivery_address  jsonb not null default '{}',
  -- Structure: { line1, line2, city, state, pincode, country }

  -- ── Payment ───────────────────────────────────────────────────────
  -- V1: Cash on Delivery only (payment_method = 'cod')
  -- Future: UPI, card, etc. payment_reference holds any transaction id.
  payment_method    text not null default 'cod'
                    check (payment_method in ('cod', 'upi', 'card', 'netbanking')),
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_reference text,                          -- UTR / transaction id for non-COD

  -- ── Pricing snapshot ──────────────────────────────────────────────
  subtotal_paise    bigint not null default 0,
  discount_paise    bigint not null default 0,
  delivery_paise    bigint not null default 0,     -- 0 = free delivery (V1)
  total_paise       bigint not null default 0,

  -- ── Order status lifecycle ────────────────────────────────────────
  -- placed → confirmed → processing → shipped → delivered
  -- Any state can transition to cancelled.
  status            text not null default 'placed'
                    check (status in ('placed','confirmed','processing','shipped','delivered','cancelled')),

  notes             text not null default '',      -- customer notes on order

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists store_orders_user_idx     on public.store_orders (user_id);
create index if not exists store_orders_status_idx   on public.store_orders (status);
create index if not exists store_orders_created_idx  on public.store_orders (created_at desc);

-- ════════════════════════════════════════════════════════════════════════
-- 2. ORDER ITEMS
-- Each order_item is a purchased product variant, with all pricing and
-- product details snapshotted at purchase time so order history stays
-- accurate even if the product is later edited or removed.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.store_orders(id) on delete cascade,

  -- Original references (kept for linkability even after edits)
  product_id      uuid references public.store_products(id) on delete set null,
  variant_id      uuid references public.store_product_variants(id) on delete set null,

  -- ── Product snapshot (at purchase time) ──────────────────────────
  product_name    text not null,
  variant_name    text not null default '',        -- e.g. "1kg – Chocolate"
  sku             text not null default '',
  image_url       text,                            -- primary image at purchase time

  -- ── Pricing snapshot ──────────────────────────────────────────────
  unit_price_paise   bigint not null,              -- selling price per unit
  compare_price_paise bigint,                      -- original price (for savings display)
  quantity           int not null check (quantity > 0),
  line_total_paise   bigint not null,              -- unit_price_paise × quantity

  created_at      timestamptz not null default now()
);

create index if not exists store_order_items_order_idx   on public.store_order_items (order_id);
create index if not exists store_order_items_product_idx on public.store_order_items (product_id);

-- ════════════════════════════════════════════════════════════════════════
-- 3. ORDER NUMBER SEQUENCE
-- A simple sequence for generating BB-YYYY-NNNNN order numbers.
-- ════════════════════════════════════════════════════════════════════════

create sequence if not exists store_order_number_seq start 1 increment 1;

create or replace function public.generate_order_number()
returns text language plpgsql as $$
begin
  return 'BB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('store_order_number_seq')::text, 5, '0');
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════

-- ── store_orders ─────────────────────────────────────────────────────────
alter table public.store_orders enable row level security;

-- Customers can see their own orders
drop policy if exists "Users view own orders"    on public.store_orders;
create policy "Users view own orders" on public.store_orders
  for select using (auth.uid() = user_id);

-- Customers can insert (place) orders for themselves
drop policy if exists "Users insert own orders"  on public.store_orders;
create policy "Users insert own orders" on public.store_orders
  for insert with check (auth.uid() = user_id);

-- Admins can see and update all orders
drop policy if exists "Admins manage orders"     on public.store_orders;
create policy "Admins manage orders" on public.store_orders
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ── store_order_items ─────────────────────────────────────────────────────
alter table public.store_order_items enable row level security;

-- Users can read items belonging to their own orders
drop policy if exists "Users view own order items"   on public.store_order_items;
create policy "Users view own order items" on public.store_order_items
  for select using (
    exists (
      select 1 from public.store_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- Users can insert items when placing an order (order_id must belong to them)
drop policy if exists "Users insert own order items" on public.store_order_items;
create policy "Users insert own order items" on public.store_order_items
  for insert with check (
    exists (
      select 1 from public.store_orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- Admins can manage all order items
drop policy if exists "Admins manage order items"    on public.store_order_items;
create policy "Admins manage order items" on public.store_order_items
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 5. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════

drop trigger if exists store_orders_updated_at on public.store_orders;
create trigger store_orders_updated_at
  before update on public.store_orders
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 6. REALTIME
-- ════════════════════════════════════════════════════════════════════════

do $$ begin
  alter publication supabase_realtime add table public.store_orders;
exception when duplicate_object then null; end $$;
