-- ════════════════════════════════════════════════════════════════════════
-- 006 — BB Store: order automation (inventory + expiry)
-- Depends on: 004 (variants), 005 (orders, order items)
--
-- Stock is held the moment an order is created (before payment), so:
--   1. deduct_inventory_on_order   atomically takes stock for each order item
--   2. restore_inventory_on_cancel puts stock back when an order is cancelled
--   3. expire_stale_pending_orders cancels unpaid orders after N minutes
--                                  (which triggers #2, releasing the stock)
--   4. revive_cancelled_order      re-takes stock if a payment arrives late
--   5. pg_cron schedule            runs #3 every 5 minutes, if pg_cron exists
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Deduct stock (atomic — no overselling) ───────────────────────────
-- The stock check and the deduction are ONE UPDATE (… where stock >= qty).
-- Postgres row-locks the variant during it, so a second simultaneous buyer
-- waits, re-checks, finds too little stock and the trigger raises
-- OUT_OF_STOCK — aborting that order-item insert, so no order is created.
create or replace function public.deduct_inventory_on_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rows_hit int;
begin
  update public.store_product_variants
     set stock_quantity = stock_quantity - new.quantity,
         availability   = case when stock_quantity - new.quantity = 0
                               then 'out_of_stock' else availability end
   where id = new.variant_id
     and stock_quantity >= new.quantity;

  get diagnostics rows_hit = row_count;
  if rows_hit = 0 then
    raise exception 'OUT_OF_STOCK:%', new.variant_id using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_deduct_inventory on public.store_order_items;
create trigger trg_deduct_inventory
  after insert on public.store_order_items
  for each row
  when (new.variant_id is not null)
  execute procedure public.deduct_inventory_on_order();

-- ── 2. Restore stock on cancellation ────────────────────────────────────
create or replace function public.restore_inventory_on_cancel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.store_product_variants v
       set stock_quantity = v.stock_quantity + oi.quantity,
           availability   = case when v.availability = 'out_of_stock' then 'active' else v.availability end
      from public.store_order_items oi
     where oi.order_id = new.id
       and oi.variant_id = v.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restore_inventory_cancel on public.store_orders;
create trigger trg_restore_inventory_cancel
  after update on public.store_orders
  for each row execute procedure public.restore_inventory_on_cancel();

-- ── 3. Expire abandoned checkouts ───────────────────────────────────────
-- Cancels orders still status='placed' + payment_status='pending' after
-- p_minutes. Called by pg_cron (#5) or GET/POST /api/store/cron/expire-orders.
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
     set status         = 'cancelled',   -- fires restore_inventory_on_cancel
         payment_status = 'failed',
         payment_error  = 'EXPIRED: payment not completed within ' || p_minutes || ' minutes.'
    from stale
   where o.id = stale.id;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── 4. Revive an expired order whose payment arrived late ───────────────
-- Re-deducts stock with the same atomic rule as #1. Returns true when the
-- order is 'placed' again (safe to mark paid); false when an item sold out
-- meanwhile (caller must flag a refund). Called by the webhook and verify-payment routes.
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
  perform 1 from public.store_orders
   where id = p_order_id and status = 'cancelled'
   for update;
  if not found then
    return false;
  end if;

  begin  -- sub-transaction: any failure rolls back ALL partial deductions
    for it in
      select variant_id, quantity
        from public.store_order_items
       where order_id = p_order_id and variant_id is not null
       order by variant_id            -- consistent lock order → no deadlocks
    loop
      update public.store_product_variants
         set stock_quantity = stock_quantity - it.quantity,
             availability   = case when stock_quantity - it.quantity = 0
                                   then 'out_of_stock' else availability end
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

  update public.store_orders
     set status = 'placed', payment_error = null
   where id = p_order_id;

  return true;
end;
$$;

revoke all on function public.expire_stale_pending_orders(int) from public, anon, authenticated;
revoke all on function public.revive_cancelled_order(uuid)     from public, anon, authenticated;
grant execute on function public.expire_stale_pending_orders(int) to service_role;
grant execute on function public.revive_cancelled_order(uuid)     to service_role;

-- ── 5. Schedule expiry every 5 minutes (only if pg_cron is available) ───
-- If not, point any scheduler at /api/store/cron/expire-orders instead.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available (%). Use /api/store/cron/expire-orders instead.', sqlerrm;
    return;
  end;

  perform cron.unschedule(jobid) from cron.job where jobname = 'expire-pending-orders';
  perform cron.schedule('expire-pending-orders', '*/5 * * * *',
                        $job$ select public.expire_stale_pending_orders(15); $job$);
exception when others then
  raise notice 'Could not schedule pg_cron job: %', sqlerrm;
end $$;
