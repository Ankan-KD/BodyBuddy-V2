-- ════════════════════════════════════════════════════════════════════════
-- 008 — BB Store: admin dashboard views
-- Depends on: 003 (user_security), 004, 005
--
--   store_low_stock_variants  published variants at or below their low-stock threshold
--   store_order_summary       one-row order counts and revenue
--
-- Supabase exposes every public view as a REST endpoint, so both views are
-- locked down in two layers:
--   1. security_invoker = true — the view runs with the CALLER's permissions
--      (respecting RLS) instead of the owner's.
--   2. An explicit admin check in the WHERE clause — needed because
--      products/variants are publicly readable, so layer 1 alone would let
--      a signed-in customer see stock levels.
-- Result: anonymous and non-admin callers get zero rows.
-- (Neither view is queried by the app yet; they are ready for an admin dashboard.)
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
    select 1 from public.user_security
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
  count(*)                                       as total_orders,
  coalesce(sum(total_paise) filter (where status <> 'cancelled'), 0) as total_revenue_paise,
  coalesce(sum(total_paise) filter (
    where status <> 'cancelled' and created_at >= date_trunc('month', now())
  ), 0) as monthly_revenue_paise
from public.store_orders
where exists (
  select 1 from public.user_security
  where user_id = auth.uid() and is_store_admin = true
);
