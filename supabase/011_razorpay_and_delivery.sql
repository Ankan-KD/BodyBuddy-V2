-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 12: Razorpay Payments + Saved Delivery Profiles
-- Run this in your Supabase SQL editor AFTER 010_seed_groups_types_from_catalogue.sql.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE / DROP-then-CREATE.
-- Does NOT touch any BB Health tables.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. STORE_ORDERS — Razorpay identifiers + widened payment method
-- ════════════════════════════════════════════════════════════════════════

alter table public.store_orders
  add column if not exists razorpay_order_id   text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature  text,
  add column if not exists payment_error       text;

-- Widen payment_method to record the *actual* Razorpay instrument used
-- (upi / card / netbanking / wallet / emi), plus a transient 'razorpay'
-- value used between order-creation and payment confirmation. 'cod' is
-- kept in the allowed set only for backward compatibility with any
-- historical rows — the checkout UI no longer offers it.
alter table public.store_orders drop constraint if exists store_orders_payment_method_check;
alter table public.store_orders add constraint store_orders_payment_method_check
  check (payment_method in ('razorpay','upi','card','netbanking','wallet','emi','cod','other'));

-- Idempotency: a Razorpay order/payment id must map to at most one of our
-- orders. Partial unique indexes so multiple NULLs are allowed (orders
-- that haven't reached that stage yet).
create unique index if not exists store_orders_razorpay_order_id_uidx
  on public.store_orders (razorpay_order_id) where razorpay_order_id is not null;

create unique index if not exists store_orders_razorpay_payment_id_uidx
  on public.store_orders (razorpay_payment_id) where razorpay_payment_id is not null;

-- ════════════════════════════════════════════════════════════════════════
-- 2. RAZORPAY WEBHOOK EVENTS — idempotency ledger
-- Records each processed webhook event id so retried/duplicate webhook
-- deliveries from Razorpay never double-apply a payment update.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_razorpay_events (
  event_id    text primary key,
  event_type  text not null default '',
  received_at timestamptz not null default now()
);

alter table public.store_razorpay_events enable row level security;
-- No client-side access at all — only the server (service role) touches
-- this table, so no policies are created for anon/authenticated roles.

-- ════════════════════════════════════════════════════════════════════════
-- 3. STORE DELIVERY PROFILES
-- Saved delivery details for BB Store checkout only. Completely separate
-- from BB Health profile data — do not join or merge with health tables.
-- Structured to allow multiple saved addresses later (is_default flag);
-- V1 UI manages a single default address per user.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_delivery_profiles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,

  recipient_name        text not null default '',
  phone                 text not null default '',
  line1                 text not null default '',
  line2                 text not null default '',
  city                  text not null default '',
  state                 text not null default '',
  pincode               text not null default '',
  country               text not null default 'India',
  delivery_instructions text not null default '',

  is_default            boolean not null default true,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists store_delivery_profiles_user_idx
  on public.store_delivery_profiles (user_id);

-- ── RLS ────────────────────────────────────────────────────────────────

alter table public.store_delivery_profiles enable row level security;

drop policy if exists "Users manage own delivery profiles" on public.store_delivery_profiles;
create policy "Users manage own delivery profiles" on public.store_delivery_profiles
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins view delivery profiles" on public.store_delivery_profiles;
create policy "Admins view delivery profiles" on public.store_delivery_profiles
  for select using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

drop trigger if exists store_delivery_profiles_updated_at on public.store_delivery_profiles;
create trigger store_delivery_profiles_updated_at
  before update on public.store_delivery_profiles
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 4. STORE SETTINGS — return-address fields for shipping labels
-- ════════════════════════════════════════════════════════════════════════

insert into public.store_settings (key, value) values
  ('return_business_name', 'BB Store'),
  ('return_address_line1', ''),
  ('return_address_line2', ''),
  ('return_city',          ''),
  ('return_state',         ''),
  ('return_pincode',       ''),
  ('return_country',       'India'),
  ('return_phone',         '')
on conflict (key) do nothing;
