-- ════════════════════════════════════════════════════════════════════════
-- 008 — BB Store: Admin Dashboard Views
-- Depends on: 004_store_catalog_schema.sql, 005_store_commerce_schema.sql,
--             007_store_security_rls.sql (user_settings admin check)
--
-- CONSOLIDATION NOTE — final-state determination (security-critical):
--   Both views were originally created as plain views in
--   006_inventory_automation.sql, which in Postgres run with the
--   permissions of the view's OWNER by default. Because Supabase
--   auto-exposes every public-schema view as a REST endpoint, this leaked
--   store-wide revenue/order counts and exact stock levels to ANY caller,
--   including an unauthenticated request using only the public anon key
--   — neither auth nor is_store_admin was checked.
--   020_fix_security_definer_views.sql fixed this with two layers, BOTH
--   of which are reproduced directly below (the plain-view versions from
--   006 are not reproduced at all, as they are a strict security
--   regression relative to this final version):
--     1. `security_invoker = true` — the view runs with the CALLING
--        user's permissions, respecting the underlying tables' RLS.
--     2. An explicit is_store_admin check embedded in each view's WHERE
--        clause — needed because store_products/store_product_variants
--        have public-read policies, so security_invoker alone would still
--        let a signed-in customer see stock data for products they can
--        browse.
--   Neither view is currently queried anywhere in the application (built
--   ahead of an admin-dashboard feature that never shipped) but both
--   remain live, queryable endpoints, so the secure definition matters
--   regardless of current usage.
-- ════════════════════════════════════════════════════════════════════════

drop view if exists public.store_low_stock_variants;
create view public.store_low_stock_variants
with (security_invoker = true) as
select
  v.id                  as variant_id,
  v.sku,
  v.name                as variant_name,
  v.stock_quantity,
  v.low_stock_threshold,
  v.availability,
  p.id                  as product_id,
  p.name                as product_name
from public.store_product_variants v
join public.store_products p on p.id = v.product_id
where v.stock_quantity <= v.low_stock_threshold
  and p.published = true
  and exists (
    select 1 from public.user_settings
    where user_id = auth.uid() and is_store_admin = true
  )
order by v.stock_quantity asc;

drop view if exists public.store_order_summary;
create view public.store_order_summary
with (security_invoker = true) as
select
  count(*) filter (where status = 'placed')      as pending_count,
  count(*) filter (where status = 'confirmed')   as confirmed_count,
  count(*) filter (where status = 'processing')  as processing_count,
  count(*) filter (where status = 'shipped')     as shipped_count,
  count(*) filter (where status = 'delivered')   as delivered_count,
  count(*) filter (where status = 'cancelled')   as cancelled_count,
  count(*)                                        as total_orders,
  coalesce(sum(total_paise) filter (where status != 'cancelled'), 0) as total_revenue_paise,
  coalesce(sum(total_paise) filter (
    where status != 'cancelled'
    and created_at >= date_trunc('month', now())
  ), 0) as monthly_revenue_paise
from public.store_orders
where exists (
  select 1 from public.user_settings
  where user_id = auth.uid() and is_store_admin = true
);

-- Sanity check after applying: as a normal signed-in (non-admin) user,
-- both of these should return zero rows:
--   select * from public.store_order_summary;
--   select * from public.store_low_stock_variants;
-- ...while a real admin account should see the full aggregate / list.
