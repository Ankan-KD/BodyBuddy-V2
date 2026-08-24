-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 9: Admin Categories, Offers & Store Controls
-- Run in Supabase SQL editor AFTER phase8_schema.sql
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE throughout.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. STORE OFFERS
-- Promotional pricing: percentage or fixed-amount discounts on products.
-- V1 focuses on product-level discounts (applied to all variants of a product).
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_offers (
  id              uuid primary key default gen_random_uuid(),

  -- Identity
  title           text not null,                        -- "Summer Sale"
  code            text unique,                          -- optional promo code (null = automatic)
  description     text not null default '',

  -- Discount
  discount_type   text not null default 'percentage'    -- 'percentage' | 'fixed_paise'
                    check (discount_type in ('percentage', 'fixed_paise')),
  discount_value  numeric not null,                     -- e.g. 20 (for 20%) or 50000 (₹500 in paise)

  -- Validity
  is_active       boolean not null default true,
  starts_at       timestamptz,                          -- null = immediate
  ends_at         timestamptz,                          -- null = no expiry

  -- Scope: which products this offer applies to
  -- null = all published products; populated array = specific products only
  product_ids     uuid[] not null default '{}',         -- empty = sitewide

  -- Caps
  min_order_paise numeric,                              -- minimum cart value to activate
  max_uses        int,                                  -- null = unlimited
  used_count      int not null default 0,

  -- Meta
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists store_offers_active_idx  on public.store_offers (is_active);
create index if not exists store_offers_code_idx    on public.store_offers (code);

-- ════════════════════════════════════════════════════════════════════════
-- 2. STORE SETTINGS
-- Key-value store for admin-controlled settings (store name, banner, etc.)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- Seed defaults (idempotent)
insert into public.store_settings (key, value) values
  ('store_name',          'BB Store'),
  ('store_tagline',       'Fuel Your Goals'),
  ('store_announcement',  ''),
  ('store_announcement_active', 'false'),
  ('maintenance_mode',    'false'),
  ('featured_category_ids', '[]')
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES
-- ════════════════════════════════════════════════════════════════════════

-- store_offers: public can read active offers; only admins can write
alter table public.store_offers enable row level security;

drop policy if exists "Anyone can read active offers"   on public.store_offers;
drop policy if exists "Admins manage offers"            on public.store_offers;

create policy "Anyone can read active offers" on public.store_offers
  for select using (is_active = true);

create policy "Admins manage offers" on public.store_offers
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

-- store_settings: public can read; only admins can write
alter table public.store_settings enable row level security;

drop policy if exists "Anyone can read settings"  on public.store_settings;
drop policy if exists "Admins manage settings"    on public.store_settings;

create policy "Anyone can read settings" on public.store_settings
  for select using (true);

create policy "Admins manage settings" on public.store_settings
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
-- 4. ADD is_featured COLUMN TO store_categories IF MISSING
-- ════════════════════════════════════════════════════════════════════════
alter table public.store_categories
  add column if not exists is_featured boolean not null default false;

-- ════════════════════════════════════════════════════════════════════════
-- 5. UPDATED_AT TRIGGERS
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_offers_updated_at on public.store_offers;
create trigger trg_offers_updated_at
  before update on public.store_offers
  for each row execute procedure public.set_updated_at();
