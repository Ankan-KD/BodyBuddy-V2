-- BodyBuddy — Fix SECURITY DEFINER views flagged by the Supabase linter
-- Run this in your Supabase SQL editor AFTER 019_remove_client_order_insert.sql.
--
-- THE BUG:
-- public.store_low_stock_variants and public.store_order_summary
-- (006_inventory_automation.sql) were created as plain views, which in
-- Postgres run with the permissions of the view's OWNER by default — not
-- the querying user. Since Supabase auto-exposes every public-schema view
-- as a REST endpoint (e.g. GET .../rest/v1/store_order_summary), and the
-- view owner's queries against store_orders / store_product_variants /
-- store_products bypass those tables' RLS entirely, this meant:
--
--   • store_order_summary leaked total + monthly revenue and order counts
--     for the ENTIRE store to any caller — including an unauthenticated
--     request using only the public anon key. Neither auth nor
--     is_store_admin was ever checked.
--   • store_low_stock_variants leaked exact stock_quantity and
--     low_stock_threshold for every published product to anyone — again
--     regardless of admin status.
--
-- Neither view is actually queried anywhere in the app (grep confirms
-- zero callers) — they were built ahead of an admin-dashboard feature
-- that never shipped — but they were still live, queryable endpoints the
-- whole time.
--
-- THE FIX (two layers, either one closes the immediate hole, both together
-- is the robust fix):
--   1. `security_invoker = true` makes the view run with the CALLING
--      user's permissions, so it respects the underlying tables' RLS
--      instead of the owner's.
--   2. An explicit `is_store_admin` gate is embedded directly in each
--      view's WHERE clause. This is the layer that actually matters here:
--      store_products/store_product_variants have public-read policies
--      (any customer can see published products), so security_invoker
--      alone would still let a plain signed-in customer read low-stock
--      data for products they can browse. The embedded admin check makes
--      both views return zero rows for anyone who isn't an admin,
--      independent of whatever grants Supabase's default schema setup
--      applies to the view itself.

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
-- ...while a real admin account should see the full aggregate / list
-- exactly as before.
