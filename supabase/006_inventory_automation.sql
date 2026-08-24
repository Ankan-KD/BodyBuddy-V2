-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 8: Orders & Inventory Schema
-- Run this in your Supabase SQL editor AFTER orders_schema.sql.
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. INVENTORY DEDUCTION ON ORDER PLACEMENT
-- When a new order is placed (status = 'placed'), automatically reduce
-- stock_quantity for each ordered variant. If stock hits 0, flip the
-- variant's availability to 'out_of_stock'.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.deduct_inventory_on_order()
returns trigger language plpgsql as $$
begin
  -- Only act on freshly inserted order items (new orders)
  -- Reduce stock for the variant
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

-- Trigger fires after each order item row is inserted
drop trigger if exists trg_deduct_inventory on public.store_order_items;
create trigger trg_deduct_inventory
  after insert on public.store_order_items
  for each row
  when (NEW.variant_id is not null)
  execute procedure public.deduct_inventory_on_order();

-- ════════════════════════════════════════════════════════════════════════
-- 2. RESTORE INVENTORY ON CANCELLATION
-- When an order is cancelled, restore stock for all its items.
-- Automatically sets availability back to 'active' if it was out_of_stock.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.restore_inventory_on_cancel()
returns trigger language plpgsql as $$
begin
  -- Only act when status transitions TO 'cancelled' from a non-cancelled state
  if NEW.status = 'cancelled' and OLD.status != 'cancelled' then
    -- Restore stock for each item in the order
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
-- 3. ADDITIONAL RLS FOR ADMIN ORDER MANAGEMENT
-- Admins need to UPDATE order status. The existing policy covers all
-- operations but let's make sure update is explicitly permitted.
-- ════════════════════════════════════════════════════════════════════════

-- The existing "Admins manage orders" policy (from orders_schema.sql)
-- covers SELECT, INSERT, UPDATE, DELETE for admins. No changes needed.

-- ════════════════════════════════════════════════════════════════════════
-- 4. ADMIN INVENTORY UPDATE POLICY
-- Admins need to update store_product_variants (stock_quantity).
-- The store_schema.sql already has admin write policies — confirm here.
-- ════════════════════════════════════════════════════════════════════════

-- If your store_schema.sql didn't add admin variant write policy, add it:
drop policy if exists "Admins manage variants" on public.store_product_variants;
create policy "Admins manage variants" on public.store_product_variants
  for all using (
    exists (
      select 1 from public.user_settings
      where user_id = auth.uid() and is_store_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.user_settings
      where user_id = auth.uid() and is_store_admin = true
    )
  );

-- ════════════════════════════════════════════════════════════════════════
-- 5. USEFUL VIEWS FOR ADMIN DASHBOARD (Phase 11 prep)
-- Low-stock summary and pending order count for dashboard metrics.
-- ════════════════════════════════════════════════════════════════════════

create or replace view public.store_low_stock_variants as
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
order by v.stock_quantity asc;

create or replace view public.store_order_summary as
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
from public.store_orders;
