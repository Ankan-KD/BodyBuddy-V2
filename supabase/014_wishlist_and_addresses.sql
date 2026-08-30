-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 13: Wishlist + Multiple Saved Addresses
-- Run this in your Supabase SQL editor AFTER 011_razorpay_and_delivery.sql
-- (and after any later-numbered migrations you've already applied).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP-then-CREATE.
-- Does NOT touch any BB Health tables.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. STORE WISHLIST ITEMS
-- One row per (user, product). Product-level (not variant-level) — the
-- shopper picks the variant when they actually add it to the cart.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.store_products(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- One wishlist entry per user + product
create unique index if not exists store_wishlist_items_user_product_uidx
  on public.store_wishlist_items (user_id, product_id);

create index if not exists store_wishlist_items_user_idx
  on public.store_wishlist_items (user_id);

alter table public.store_wishlist_items enable row level security;

drop policy if exists "Users manage own wishlist" on public.store_wishlist_items;
create policy "Users manage own wishlist" on public.store_wishlist_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════════════
-- 2. MULTIPLE SAVED DELIVERY ADDRESSES
-- store_delivery_profiles already allows many rows per user (see
-- 011_razorpay_and_delivery.sql) — V1 only ever exposed a single default
-- row through the UI/API. This adds a friendly label ("Home", "Work", ...)
-- and enforces that at most one row per user is flagged as default, so
-- "which address is used at checkout by default" is unambiguous even
-- with several saved addresses that may share the same recipient name,
-- phone number, or address text.
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_delivery_profiles
  add column if not exists label text not null default 'Home';

comment on column public.store_delivery_profiles.label is
  'Short user-facing name for this saved address, e.g. Home, Work, Parents place.';

-- Enforce a single default address per user. A trigger (rather than a bare
-- partial unique index) is used so the API can simply insert/update a row
-- with is_default = true without first having to hunt down and clear the
-- previous default in a separate round trip — the database keeps it
-- consistent automatically, including for the very first address a user
-- ever saves.
create or replace function public.enforce_single_default_address()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.store_delivery_profiles
      set is_default = false
      where user_id = new.user_id
        and id <> new.id
        and is_default = true;
  end if;
  return new;
end;
$$;

drop trigger if exists store_delivery_profiles_single_default on public.store_delivery_profiles;
create trigger store_delivery_profiles_single_default
  before insert or update of is_default on public.store_delivery_profiles
  for each row
  when (new.is_default)
  execute procedure public.enforce_single_default_address();

-- Backfill: if a user somehow ended up with more than one default row
-- (pre-trigger data), keep only the most recently updated one.
with ranked as (
  select id, row_number() over (
    partition by user_id order by updated_at desc, created_at desc
  ) as rn
  from public.store_delivery_profiles
  where is_default
)
update public.store_delivery_profiles p
  set is_default = false
  from ranked r
  where p.id = r.id and r.rn > 1;
