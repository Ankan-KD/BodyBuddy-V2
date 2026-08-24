-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 6: Cart Schema
-- Run this in your Supabase SQL editor AFTER store_schema.sql.
-- Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- ── Cart Items ────────────────────────────────────────────────────────────

create table if not exists public.store_cart_items (

  id          uuid primary key default gen_random_uuid(),

  user_id     uuid not null references auth.users(id) on delete cascade,

  product_id  uuid not null references public.store_products(id) on delete cascade,

  variant_id  uuid not null references public.store_product_variants(id) on delete cascade,

  quantity    int not null default 1 check (quantity > 0),

  created_at  timestamptz not null default now(),

  updated_at  timestamptz not null default now()

);

-- One cart line per user + variant

create unique index if not exists store_cart_items_user_variant_idx
  on public.store_cart_items (user_id, variant_id);

create index if not exists store_cart_items_user_idx
  on public.store_cart_items (user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.store_cart_items enable row level security;

-- Users can only see and modify their own cart rows

drop policy if exists "Users manage own cart"
  on public.store_cart_items;

create policy "Users manage own cart"
  on public.store_cart_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────

create or replace function public.set_updated_at()

returns trigger
language plpgsql
as $$

begin

  new.updated_at = now();

  return new;

end;

$$;

drop trigger if exists store_cart_items_updated_at
  on public.store_cart_items;

create trigger store_cart_items_updated_at

  before update
  on public.store_cart_items

  for each row
  execute procedure public.set_updated_at();