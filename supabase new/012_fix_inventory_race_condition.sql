-- ════════════════════════════════════════════════════════════════════════
-- 012 — Fix overselling race condition (check-then-act / TOCTOU)
--
-- BEFORE: stock was checked in app code, then deducted later by a trigger
--         with greatest(0, stock - qty). Two simultaneous buyers could both
--         pass the check, and the clamp hid the oversell.
--
-- AFTER:  the check and the deduction are ONE atomic UPDATE
--         (... WHERE stock_quantity >= qty). Postgres row-locks the variant
--         during the UPDATE, so the second buyer waits, re-checks, finds
--         not enough stock, and the trigger raises OUT_OF_STOCK. That aborts
--         the order-items INSERT, so no order is created for them.
-- Safe to re-run. Run AFTER 005_store_commerce_schema.sql.
-- ════════════════════════════════════════════════════════════════════════

-- Safety net: stock can never go negative, whatever the code does.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'store_product_variants_stock_non_negative'
  ) then
    alter table public.store_product_variants
      add constraint store_product_variants_stock_non_negative
      check (stock_quantity >= 0);
  end if;
end $$;

create or replace function public.deduct_inventory_on_order()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rows_hit int;
begin
  -- Atomic check + deduct. The WHERE clause is the "check"; because it is
  -- evaluated while the row is locked, no other transaction can sneak in
  -- between the check and the write.
  update public.store_product_variants
  set
    stock_quantity = stock_quantity - NEW.quantity,
    availability   = case
                       when stock_quantity - NEW.quantity = 0
                       then 'out_of_stock'
                       else availability
                     end,
    updated_at     = now()
  where id = NEW.variant_id
    and stock_quantity >= NEW.quantity;

  get diagnostics rows_hit = row_count;

  if rows_hit = 0 then
    -- Not enough stock (someone else just took it). Abort this INSERT.
    raise exception 'OUT_OF_STOCK:%', NEW.variant_id
      using errcode = 'P0001';
  end if;

  return NEW;
end;
$$;

-- Trigger itself is unchanged (re-created for safety).
drop trigger if exists trg_deduct_inventory on public.store_order_items;
create trigger trg_deduct_inventory
  after insert on public.store_order_items
  for each row
  when (NEW.variant_id is not null)
  execute procedure public.deduct_inventory_on_order();
