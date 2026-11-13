-- ════════════════════════════════════════════════════════════════════════
-- 013 — Auto-expire abandoned checkouts + safe revival of late payments
-- Run AFTER 012_fix_inventory_race_condition.sql. Safe to re-run.
--
-- PROBLEM: stock is deducted when an order is created (before payment). If
--   the customer closes the tab / loses network, mark-failed never runs and
--   the unit stays held forever.
--
-- 1) expire_stale_pending_orders(minutes)
--      Cancels orders that are still status='placed' + payment_status='pending'
--      after N minutes. The existing restore_inventory_on_cancel trigger puts
--      the stock back automatically.
--
-- 2) revive_cancelled_order(order_id)
--      A payment can still arrive AFTER expiry (e.g. slow UPI). This
--      re-deducts stock atomically (same "WHERE stock >= qty" rule as 012).
--      Returns true  -> order is 'placed' again, safe to mark paid.
--      Returns false -> item sold out meanwhile; caller must flag a refund.
--
-- 3) pg_cron schedule (every 5 min) — only if the extension is available.
--    If not, call GET/POST /api/store/cron/expire-orders from any scheduler.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.expire_stale_pending_orders(p_minutes int default 15)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with stale as (
    select id
    from public.store_orders
    where status = 'placed'
      and payment_status = 'pending'
      and created_at < now() - make_interval(mins => p_minutes)
    for update skip locked          -- don't fight a payment being verified right now
  )
  update public.store_orders o
  set status         = 'cancelled',          -- fires restore_inventory_on_cancel
      payment_status = 'failed',
      payment_error  = 'EXPIRED: payment not completed within ' || p_minutes || ' minutes.'
  from stale
  where o.id = stale.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_stale_pending_orders(int) from public, anon, authenticated;
grant execute on function public.expire_stale_pending_orders(int) to service_role;


create or replace function public.revive_cancelled_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  it record;
  rows_hit int;
begin
  -- Lock the order row; only revive something that is actually cancelled.
  perform 1 from public.store_orders
   where id = p_order_id and status = 'cancelled'
   for update;
  if not found then
    return false;
  end if;

  begin  -- sub-transaction: any failure below rolls back ALL partial deductions
    for it in
      select variant_id, quantity
      from public.store_order_items
      where order_id = p_order_id and variant_id is not null
      order by variant_id            -- consistent lock order (no deadlocks)
    loop
      update public.store_product_variants
      set stock_quantity = stock_quantity - it.quantity,
          availability   = case when stock_quantity - it.quantity = 0
                                then 'out_of_stock' else availability end,
          updated_at     = now()
      where id = it.variant_id
        and stock_quantity >= it.quantity;

      get diagnostics rows_hit = row_count;
      if rows_hit = 0 then
        raise exception 'OUT_OF_STOCK:%', it.variant_id;
      end if;
    end loop;
  exception when others then
    return false;
  end;

  -- Stock re-taken. 'placed' (not 'cancelled'), so the cancel trigger will
  -- restore it correctly if this order is ever cancelled again.
  update public.store_orders
  set status = 'placed', payment_error = null
  where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.revive_cancelled_order(uuid) from public, anon, authenticated;
grant execute on function public.revive_cancelled_order(uuid) to service_role;


-- ── Schedule with pg_cron if available ──────────────────────────────────
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available (%). Use /api/store/cron/expire-orders instead.', sqlerrm;
    return;
  end;

  -- re-runnable: drop old schedule first
  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-pending-orders';
  perform cron.schedule(
    'expire-pending-orders',
    '*/5 * * * *',
    $job$ select public.expire_stale_pending_orders(15); $job$
  );
exception when others then
  raise notice 'Could not schedule pg_cron job: %', sqlerrm;
end $$;
