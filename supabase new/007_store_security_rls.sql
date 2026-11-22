-- ════════════════════════════════════════════════════════════════════════
-- 007 — BB Store: Row Level Security
-- Depends on: 003 (user_security), 004, 005
--
-- Every store policy lives here so the whole access-control surface can be
-- audited in one file.
--
-- "Admin" below means a row in public.user_security with is_store_admin =
-- true for auth.uid(). Users can read only their own user_security row and
-- can never write it (see 003), so admin status cannot be self-granted.
--
-- Access summary
--   Catalog (categories, brands, products, variants, groups, types,
--     catalogue)        → public read (filtered, see below); admin write
--   Cart, wishlist      → owner only
--   Delivery profiles   → owner full access; admins read-only
--   Orders / items      → owner read-only; admin full access; NO client
--                         INSERT policy (see note in section 4)
--   Offers              → public read of active offers; admin write
--   Settings            → public read; admin write
--   Audit log           → admin only
--   Razorpay events     → no policies: service role only
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Catalog — public read, admin write ─────────────────────────────

alter table public.store_categories enable row level security;
drop policy if exists "store_categories_public_read" on public.store_categories;
create policy "store_categories_public_read" on public.store_categories for select using (is_active = true);

drop policy if exists "store_categories_admin_all" on public.store_categories;
create policy "store_categories_admin_all" on public.store_categories
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_brands enable row level security;
drop policy if exists "store_brands_public_read" on public.store_brands;
create policy "store_brands_public_read" on public.store_brands for select using (is_active = true);

drop policy if exists "store_brands_admin_all" on public.store_brands;
create policy "store_brands_admin_all" on public.store_brands
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_products enable row level security;
-- Customers see only published products that are neither inactive nor discontinued.
drop policy if exists "store_products_public_read" on public.store_products;
create policy "store_products_public_read" on public.store_products for select using (published = true and availability not in ('inactive','discontinued'));

drop policy if exists "store_products_admin_all" on public.store_products;
create policy "store_products_admin_all" on public.store_products
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_product_variants enable row level security;
drop policy if exists "store_variants_public_read" on public.store_product_variants;
create policy "store_variants_public_read" on public.store_product_variants
  for select using (
    availability not in ('inactive','discontinued')
    and exists (
      select 1 from public.store_products p
      where p.id = product_id and p.published = true and p.availability <> 'inactive'
    )
  );

drop policy if exists "store_variants_admin_all" on public.store_product_variants;
create policy "store_variants_admin_all" on public.store_product_variants
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_product_categories enable row level security;
drop policy if exists "store_product_categories_public_read" on public.store_product_categories;
create policy "store_product_categories_public_read" on public.store_product_categories for select using (true);

drop policy if exists "store_product_categories_admin_all" on public.store_product_categories;
create policy "store_product_categories_admin_all" on public.store_product_categories
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));


-- ── 2. Groups, types and master catalogue — public read, admin write ──

alter table public.product_groups enable row level security;
drop policy if exists "product_groups_read" on public.product_groups;
create policy "product_groups_read" on public.product_groups for select using (true);

drop policy if exists "product_groups_admin_write" on public.product_groups;
create policy "product_groups_admin_write" on public.product_groups
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.product_types enable row level security;
drop policy if exists "product_types_read" on public.product_types;
create policy "product_types_read" on public.product_types for select using (true);

drop policy if exists "product_types_admin_write" on public.product_types;
create policy "product_types_admin_write" on public.product_types
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.product_catalogue enable row level security;
drop policy if exists "catalogue_read" on public.product_catalogue;
create policy "catalogue_read" on public.product_catalogue for select using (true);

drop policy if exists "catalogue_admin_write" on public.product_catalogue;
create policy "catalogue_admin_write" on public.product_catalogue
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.product_catalogue_variants enable row level security;
drop policy if exists "catalogue_var_read" on public.product_catalogue_variants;
create policy "catalogue_var_read" on public.product_catalogue_variants for select using (true);

drop policy if exists "catalogue_var_admin_write" on public.product_catalogue_variants;
create policy "catalogue_var_admin_write" on public.product_catalogue_variants
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));


-- ── 3. Cart, wishlist, delivery profiles — owner only ─────────────────

alter table public.store_cart_items enable row level security;
drop policy if exists "Users manage own cart" on public.store_cart_items;
create policy "Users manage own cart" on public.store_cart_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.store_wishlist_items enable row level security;
drop policy if exists "Users manage own wishlist" on public.store_wishlist_items;
create policy "Users manage own wishlist" on public.store_wishlist_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.store_delivery_profiles enable row level security;
drop policy if exists "Users manage own delivery profiles" on public.store_delivery_profiles;
create policy "Users manage own delivery profiles" on public.store_delivery_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins view delivery profiles" on public.store_delivery_profiles;
create policy "Admins view delivery profiles" on public.store_delivery_profiles
  for select using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));


-- ── 4. Orders — owner reads, admin manages, server inserts ────────────

-- There is deliberately NO client INSERT policy on store_orders or
-- store_order_items. Orders are created only by POST
-- /api/store/checkout/create-order using the service-role key, which prices
-- the cart server-side and talks to Razorpay. A client insert policy would
-- let any signed-in user create a "paid" order at any price straight from
-- the browser. Do not add one.
alter table public.store_orders enable row level security;
drop policy if exists "Users view own orders" on public.store_orders;
create policy "Users view own orders" on public.store_orders
  for select using (auth.uid() = user_id);

drop policy if exists "Admins manage orders" on public.store_orders;
create policy "Admins manage orders" on public.store_orders
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_order_items enable row level security;
drop policy if exists "Users view own order items" on public.store_order_items;
create policy "Users view own order items" on public.store_order_items
  for select using (
    exists (select 1 from public.store_orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists "Admins manage order items" on public.store_order_items;
create policy "Admins manage order items" on public.store_order_items
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

-- Server-only table: RLS on, no policies → only the service role can touch it.
alter table public.store_razorpay_events enable row level security;


-- ── 5. Offers & settings — public read, admin write ───────────────────

alter table public.store_offers enable row level security;
drop policy if exists "Anyone can read active offers" on public.store_offers;
create policy "Anyone can read active offers" on public.store_offers for select using (is_active = true);

drop policy if exists "Admins manage offers" on public.store_offers;
create policy "Admins manage offers" on public.store_offers
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));

alter table public.store_settings enable row level security;
drop policy if exists "Anyone can read settings" on public.store_settings;
create policy "Anyone can read settings" on public.store_settings for select using (true);

drop policy if exists "Admins manage settings" on public.store_settings;
create policy "Admins manage settings" on public.store_settings
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));


-- ── 6. Admin audit log — admin only ───────────────────────────────────

alter table public.admin_audit_log enable row level security;
drop policy if exists "admin_audit_admin_only" on public.admin_audit_log;
create policy "admin_audit_admin_only" on public.admin_audit_log
  for all using (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true))
  with check (exists (select 1 from public.user_security where user_id = auth.uid() and is_store_admin = true));
