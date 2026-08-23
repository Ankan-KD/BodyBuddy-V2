-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Phase 2: Product & Category Backend
-- Run this in your Supabase SQL editor AFTER schema.sql has been applied.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- ════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ════════════════════════════════════════════════════════════════════════
-- 1. CATEGORIES
-- Two-level hierarchy: top-level category → subcategory.
-- Subcategories have a non-null parent_id; top-level rows have parent_id NULL.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_categories (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.store_categories(id) on delete set null,
  slug          text not null unique,               -- URL-safe: "protein", "whey-protein"
  name          text not null,                      -- Display name: "Protein", "Whey Protein"
  description   text not null default '',
  icon_key      text not null default 'Tag',        -- lucide-react icon key
  image_url     text,                               -- hero/thumbnail image
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists store_categories_parent_idx on public.store_categories (parent_id);
create index if not exists store_categories_slug_idx   on public.store_categories (slug);

-- ════════════════════════════════════════════════════════════════════════
-- 2. BRANDS
-- Lightweight brand registry — products reference a brand_id.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  website_url text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- 3. PRODUCTS
-- Core product record. One product can have many variants (see below).
-- Prices, stock, and SKUs live on variants; the product holds shared info.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_products (
  id               uuid primary key default gen_random_uuid(),

  -- Identity
  name             text not null,
  slug             text not null unique,             -- for clean URLs: /store/products/whey-protein-isolate
  brand_id         uuid references public.store_brands(id) on delete set null,
  category_id      uuid references public.store_categories(id) on delete set null,

  -- Content
  short_description  text not null default '',
  full_description   text not null default '',       -- markdown supported
  usage_info         text not null default '',       -- "Take 1 scoop post-workout with 200ml water"
  ingredients        text not null default '',       -- full ingredient list
  warnings           text not null default '',       -- allergens, contraindications

  -- Images  (ordered array of public URLs; first element = primary)
  images           text[] not null default '{}',

  -- Tags / searchability
  tags             text[] not null default '{}',     -- e.g. {"keto","vegan","bestseller"}
  health_goal_tags text[] not null default '{}',     -- e.g. {"muscle-gain","weight-loss","immunity"}

  -- ── Health / Nutrition Metadata (per serving) ────────────────────────
  -- All per-serving values. serving_size_g is the canonical reference unit.
  serving_size_label   text not null default '',     -- "1 scoop (30g)"
  serving_size_g       numeric,                      -- grams per serving (null if not applicable)
  calories_per_serving numeric,
  protein_per_serving  numeric,                      -- grams
  carbs_per_serving    numeric,
  fat_per_serving      numeric,
  fibre_per_serving    numeric,
  sodium_per_serving   numeric,                      -- milligrams
  sugar_per_serving    numeric,

  -- ── Publishing / Visibility ──────────────────────────────────────────
  -- published=false means admins can see it but customers cannot.
  published        boolean not null default false,

  -- ── Availability ─────────────────────────────────────────────────────
  -- 'active'        → visible and purchasable
  -- 'inactive'      → visible to admin only (overrides published flag)
  -- 'out_of_stock'  → visible to customers but cannot be added to cart
  -- 'discontinued'  → permanently removed; kept for order history integrity
  availability     text not null default 'active'
                   check (availability in ('active','inactive','out_of_stock','discontinued')),

  -- ── Ratings cache (denormalised for fast reads) ──────────────────────
  rating_average   numeric(3,2) not null default 0,
  rating_count     int not null default 0,

  -- ── Sort / featured ──────────────────────────────────────────────────
  sort_order       int not null default 0,
  is_featured      boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists store_products_category_idx    on public.store_products (category_id);
create index if not exists store_products_brand_idx       on public.store_products (brand_id);
create index if not exists store_products_slug_idx        on public.store_products (slug);
create index if not exists store_products_published_idx   on public.store_products (published, availability);
create index if not exists store_products_featured_idx    on public.store_products (is_featured) where is_featured = true;

-- Full-text search index over name + description
create index if not exists store_products_fts_idx on public.store_products
  using gin(to_tsvector('english', name || ' ' || coalesce(short_description,'') || ' ' || coalesce(full_description,'')));

-- ════════════════════════════════════════════════════════════════════════
-- 4. PRODUCT VARIANTS
-- Each product has at least one variant (e.g. "1kg / Chocolate",
-- "500g / Unflavoured"). Price, SKU, and stock are variant-level.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.store_products(id) on delete cascade not null,

  -- Variant identity
  sku             text not null unique,
  name            text not null default '',          -- e.g. "1kg – Chocolate"
  size_label      text not null default '',          -- e.g. "1kg", "500g", "60 caps"
  flavour         text not null default '',          -- e.g. "Chocolate Fudge", "Unflavoured"
  color           text not null default '',          -- for non-food products

  -- Pricing (in smallest currency unit, e.g. paise for INR)
  price_paise     bigint not null,                   -- selling price
  compare_price_paise bigint,                        -- original/strikethrough price (null = no sale)

  -- Inventory
  stock_quantity  int not null default 0,
  low_stock_threshold int not null default 5,        -- triggers "Low stock" label on storefront

  -- Images specific to this variant (overrides product images when set)
  images          text[] not null default '{}',

  -- Variant-level availability (inherits product availability if null)
  availability    text not null default 'active'
                  check (availability in ('active','inactive','out_of_stock','discontinued')),

  is_default      boolean not null default false,    -- which variant is pre-selected on the PDP
  sort_order      int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists store_variants_product_idx on public.store_product_variants (product_id);
create index if not exists store_variants_sku_idx     on public.store_product_variants (sku);

-- ════════════════════════════════════════════════════════════════════════
-- 5. PRODUCT–CATEGORY JUNCTION
-- A product can appear in multiple categories (e.g. a protein bar lives
-- in both "Protein" and "Health Foods"). The primary category is on the
-- product row itself; extras go here.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_product_categories (
  product_id  uuid references public.store_products(id) on delete cascade not null,
  category_id uuid references public.store_categories(id) on delete cascade not null,
  primary key (product_id, category_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- Products and categories are public reads; writes are admin-only.
-- Admin flag is stored in user_settings via a simple boolean column added
-- below. Alternatively, a Supabase custom claim / JWT role can be used in
-- production — the policy is written to check both paths.
-- ════════════════════════════════════════════════════════════════════════

-- Add is_store_admin flag to user_settings so we can gate write policies.
alter table public.user_settings
  add column if not exists is_store_admin boolean not null default false;

-- ── store_categories ────────────────────────────────────────────────────
alter table public.store_categories enable row level security;

drop policy if exists "store_categories_public_read"  on public.store_categories;
create policy "store_categories_public_read" on public.store_categories
  for select using (is_active = true);

drop policy if exists "store_categories_admin_all" on public.store_categories;
create policy "store_categories_admin_all" on public.store_categories
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

-- ── store_brands ────────────────────────────────────────────────────────
alter table public.store_brands enable row level security;

drop policy if exists "store_brands_public_read" on public.store_brands;
create policy "store_brands_public_read" on public.store_brands
  for select using (is_active = true);

drop policy if exists "store_brands_admin_all" on public.store_brands;
create policy "store_brands_admin_all" on public.store_brands
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ── store_products ───────────────────────────────────────────────────────
alter table public.store_products enable row level security;

-- Customers see only published + active products
drop policy if exists "store_products_public_read" on public.store_products;
create policy "store_products_public_read" on public.store_products
  for select using (published = true and availability != 'inactive' and availability != 'discontinued');

-- Admins see everything and can write
drop policy if exists "store_products_admin_all" on public.store_products;
create policy "store_products_admin_all" on public.store_products
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ── store_product_variants ───────────────────────────────────────────────
alter table public.store_product_variants enable row level security;

drop policy if exists "store_variants_public_read" on public.store_product_variants;
create policy "store_variants_public_read" on public.store_product_variants
  for select using (
    exists (
      select 1 from public.store_products p
      where p.id = product_id and p.published = true and p.availability != 'inactive'
    )
    and availability != 'inactive'
    and availability != 'discontinued'
  );

drop policy if exists "store_variants_admin_all" on public.store_product_variants;
create policy "store_variants_admin_all" on public.store_product_variants
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ── store_product_categories ─────────────────────────────────────────────
alter table public.store_product_categories enable row level security;

drop policy if exists "store_product_categories_public_read" on public.store_product_categories;
create policy "store_product_categories_public_read" on public.store_product_categories
  for select using (true);

drop policy if exists "store_product_categories_admin_all" on public.store_product_categories;
create policy "store_product_categories_admin_all" on public.store_product_categories
  for all using (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  )
  with check (
    exists (select 1 from public.user_settings where user_id = auth.uid() and is_store_admin = true)
  );

-- ════════════════════════════════════════════════════════════════════════
-- 7. AUTO-UPDATE updated_at TRIGGERS
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists store_categories_updated_at on public.store_categories;
create trigger store_categories_updated_at
  before update on public.store_categories
  for each row execute procedure public.set_updated_at();

drop trigger if exists store_products_updated_at on public.store_products;
create trigger store_products_updated_at
  before update on public.store_products
  for each row execute procedure public.set_updated_at();

drop trigger if exists store_variants_updated_at on public.store_product_variants;
create trigger store_variants_updated_at
  before update on public.store_product_variants
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 8. REALTIME — subscribe to product/category changes in the storefront
-- ════════════════════════════════════════════════════════════════════════

do $$ begin
  alter publication supabase_realtime add table public.store_categories;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.store_products;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.store_product_variants;
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. SEED DATA — starter categories & a sample brand
-- Gives the store something to show immediately after schema setup.
-- All products start as published=false so nothing leaks to customers yet.
-- ════════════════════════════════════════════════════════════════════════

insert into public.store_categories (slug, name, description, icon_key, sort_order)
values
  ('protein',       'Protein',          'Whey, casein, plant-based and more',              'Dumbbell',  1),
  ('fat-burners',   'Fat Burners',      'Thermogenics, CLA, L-Carnitine',                  'Flame',     2),
  ('organic',       'Organic',          'Certified organic, whole food nutrition',          'Leaf',      3),
  ('vitamins',      'Vitamins',         'Multivitamins, vitamin D, B12 and more',           'Pill',      4),
  ('pre-workout',   'Pre-Workout',      'Energy, focus and endurance boosters',             'Zap',       5),
  ('health-foods',  'Health Foods',     'Superfoods, protein bars, clean snacks',           'Apple',     6),
  ('heart-health',  'Heart Health',     'Omega-3, CoQ10, Magnesium',                       'Heart',     7),
  ('hydration',     'Hydration',        'Electrolytes, hydration mixes',                   'Droplets',  8),
  ('sleep-recovery','Sleep & Recovery', 'Melatonin, magnesium, adaptogens',                'Moon',      9),
  ('performance',   'Performance',      'Creatine, BCAA, amino acids',                     'Activity', 10)
on conflict (slug) do nothing;

-- Subcategories for "Protein"
insert into public.store_categories (parent_id, slug, name, description, icon_key, sort_order)
select
  c.id,
  sub.slug, sub.name, sub.description, sub.icon_key, sub.sort_order
from public.store_categories c
cross join (values
  ('whey-protein',  'Whey Protein',  'Fast-absorbing whey concentrate & isolate', 'Dumbbell', 1),
  ('casein-protein','Casein Protein', 'Slow-release for overnight recovery',       'Moon',     2),
  ('plant-protein', 'Plant Protein', 'Pea, rice, hemp and blended plant sources', 'Leaf',     3),
  ('protein-bars',  'Protein Bars',  'High-protein bars and bites',                'Cookie',   4)
) as sub(slug, name, description, icon_key, sort_order)
where c.slug = 'protein'
on conflict (slug) do nothing;

-- Sample brand
insert into public.store_brands (name, slug)
values ('BodyBuddy Nutrition', 'bodybuddy-nutrition')
on conflict (slug) do nothing;
