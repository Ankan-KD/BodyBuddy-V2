-- ════════════════════════════════════════════════════════════════════════
-- 007 — BB Store: Row Level Security & Policies
-- Depends on: 002_core_health_schema.sql (user_settings.is_store_admin),
--             004_store_catalog_schema.sql, 005_store_commerce_schema.sql,
--             006_store_admin_security.sql
--
-- Every RLS policy for every BB Store table lives in this one file so the
-- store's entire access-control surface can be audited in a single place.
-- Products/categories are public reads; writes are admin-only, gated on
-- public.user_settings.is_store_admin (protected from self-escalation by
-- the trigger in 003_auth_and_signup_security.sql).
--
-- CONSOLIDATION NOTE — security-critical final states applied here:
--   • store_orders / store_order_items: the original "Users insert own
--     orders" / "Users insert own order items" policies
--     (005_store_orders.sql) are INTENTIONALLY NOT reproduced.
--     019_remove_client_order_insert.sql dropped them permanently because
--     they let any signed-in user fabricate a fully "paid" order at an
--     arbitrary price directly via the Supabase client, bypassing
--     Razorpay entirely. Checkout is server-side only
--     (POST /api/store/checkout/create-order, service-role client) and
--     needs no client INSERT policy. SELECT policies (customers reading
--     their own orders) are preserved unchanged. Reintroducing an insert
--     policy here would be a security regression — do not add one back
--     without re-deriving pricing/validation guarantees server-side.
--   • store_product_variants: 006_inventory_automation.sql added a
--     second, functionally-identical "Admins manage variants" ALL policy
--     on top of the one already created for this table. Only one
--     ("store_variants_admin_all") is kept below — pure duplicate,
--     removed.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. CATALOG — public read, admin write
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_categories enable row level security;
drop policy if exists "store_categories_public_read"  on public.store_categories;
create policy "store_categories_public_read" on public.store_categories
  for select using (is_active = true);
drop policy if exists "store_categories_admin_all" on public.store_categories;
create policy "store_categories_admin_all" on public.store_categories
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_brands enable row level security;
drop policy if exists "store_brands_public_read" on public.store_brands;
create policy "store_brands_public_read" on public.store_brands
  for select using (is_active = true);
drop policy if exists "store_brands_admin_all" on public.store_brands;
create policy "store_brands_admin_all" on public.store_brands
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_products enable row level security;
-- Customers see only published + active products; admins see/write everything.
drop policy if exists "store_products_public_read" on public.store_products;
create policy "store_products_public_read" on public.store_products
  for select using (published = true and availability != 'inactive' and availability != 'discontinued');
drop policy if exists "store_products_admin_all" on public.store_products;
create policy "store_products_admin_all" on public.store_products
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_product_variants enable row level security;
drop policy if exists "store_variants_public_read" on public.store_product_variants;
create policy "store_variants_public_read" on public.store_product_variants
  for select using (
    exists (
      select 1 from public.store_products p
      where p.id = product_id and p.published = true and p.availability != 'inactive'
    )
    and availability != 'inactive'
    and availability != 'discontinued'
  );
drop policy if exists "store_variants_admin_all" on public.store_product_variants;
drop policy if exists "Admins manage variants" on public.store_product_variants; -- duplicate from 006_inventory_automation.sql, not recreated
create policy "store_variants_admin_all" on public.store_product_variants
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_product_categories enable row level security;
drop policy if exists "store_product_categories_public_read" on public.store_product_categories;
create policy "store_product_categories_public_read" on public.store_product_categories
  for select using (true);
drop policy if exists "store_product_categories_admin_all" on public.store_product_categories;
create policy "store_product_categories_admin_all" on public.store_product_categories
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ── Product Groups / Types / Catalogue (009_catalogue_redesign.sql) ──────
-- Postgres has no "CREATE POLICY IF NOT EXISTS" — DROP IF EXISTS then
-- CREATE is the correct safe-to-re-run pattern used throughout.

alter table public.product_groups             enable row level security;
alter table public.product_types              enable row level security;
alter table public.product_catalogue          enable row level security;
alter table public.product_catalogue_variants enable row level security;

drop policy if exists "product_groups_read"         on public.product_groups;
drop policy if exists "product_groups_admin_write"  on public.product_groups;
create policy "product_groups_read" on public.product_groups for select using (true);
create policy "product_groups_admin_write" on public.product_groups
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

drop policy if exists "product_types_read"        on public.product_types;
drop policy if exists "product_types_admin_write" on public.product_types;
create policy "product_types_read" on public.product_types for select using (true);
create policy "product_types_admin_write" on public.product_types
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

drop policy if exists "catalogue_read"         on public.product_catalogue;
drop policy if exists "catalogue_admin_write"  on public.product_catalogue;
create policy "catalogue_read" on public.product_catalogue for select using (true);
create policy "catalogue_admin_write" on public.product_catalogue
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

drop policy if exists "catalogue_var_read"        on public.product_catalogue_variants;
drop policy if exists "catalogue_var_admin_write" on public.product_catalogue_variants;
create policy "catalogue_var_read" on public.product_catalogue_variants for select using (true);
create policy "catalogue_var_admin_write" on public.product_catalogue_variants
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 2. ADMIN AUDIT LOG — admins only
-- ════════════════════════════════════════════════════════════════════════

alter table public.admin_audit_log enable row level security;
drop policy if exists "admin_audit_admin_only" on public.admin_audit_log;
create policy "admin_audit_admin_only" on public.admin_audit_log
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 3. CART — user manages own rows only
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_cart_items enable row level security;
drop policy if exists "Users manage own cart" on public.store_cart_items;
create policy "Users manage own cart" on public.store_cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 4. ORDERS — customers read their own; only the server (service role)
--    ever inserts; admins can read/update/delete all. See the
--    CONSOLIDATION NOTE at the top of this file re: no INSERT policy.
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_orders enable row level security;
drop policy if exists "Users view own orders" on public.store_orders;
create policy "Users view own orders" on public.store_orders
  for select using (auth.uid() = user_id);
drop policy if exists "Users insert own orders" on public.store_orders; -- removed by 019, not recreated
drop policy if exists "Admins manage orders" on public.store_orders;
create policy "Admins manage orders" on public.store_orders
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_order_items enable row level security;
drop policy if exists "Users view own order items" on public.store_order_items;
create policy "Users view own order items" on public.store_order_items
  for select using (
    exists (select 1 from public.store_orders o where o.id = order_id and o.user_id = auth.uid())
  );
drop policy if exists "Users insert own order items" on public.store_order_items; -- removed by 019, not recreated
drop policy if exists "Admins manage order items" on public.store_order_items;
create policy "Admins manage order items" on public.store_order_items
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- store_razorpay_events: no client-side access at all — only the server
-- (service role) touches this table, so no policies are created for
-- anon/authenticated roles.
alter table public.store_razorpay_events enable row level security;

-- ════════════════════════════════════════════════════════════════════════
-- 5. DELIVERY PROFILES — user manages own; admins can view all
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_delivery_profiles enable row level security;
drop policy if exists "Users manage own delivery profiles" on public.store_delivery_profiles;
create policy "Users manage own delivery profiles" on public.store_delivery_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins view delivery profiles" on public.store_delivery_profiles;
create policy "Admins view delivery profiles" on public.store_delivery_profiles
  for select using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 6. WISHLIST — user manages own rows only
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_wishlist_items enable row level security;
drop policy if exists "Users manage own wishlist" on public.store_wishlist_items;
create policy "Users manage own wishlist" on public.store_wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 7. OFFERS & SETTINGS — public read (active offers / all settings),
--    admin write
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_offers enable row level security;
drop policy if exists "Anyone can read active offers" on public.store_offers;
drop policy if exists "Admins manage offers" on public.store_offers;
create policy "Anyone can read active offers" on public.store_offers
  for select using (is_active = true);
create policy "Admins manage offers" on public.store_offers
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

alter table public.store_settings enable row level security;
drop policy if exists "Anyone can read settings" on public.store_settings;
drop policy if exists "Admins manage settings" on public.store_settings;
create policy "Anyone can read settings" on public.store_settings
  for select using (true);
create policy "Admins manage settings" on public.store_settings
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );
