-- ════════════════════════════════════════════════════════════════════════
-- 004 — BB Store: Catalog Schema (Categories, Brands, Product Groups/Types,
--        Products, Variants, Catalogue)
-- Depends on: 001_extensions_and_shared_functions.sql
--
-- CONSOLIDATION NOTE — final-state determination:
--   public.store_products below folds in every column added after its
--   original CREATE TABLE:
--     - product_type, catalog_source_id   (008_product_type_and_categories.sql)
--     - product_group_id, product_type_id (009_catalogue_redesign.sql)
--   No ALTER TABLE statements are needed for a fresh install; the final
--   shape is defined directly. Because store_products has FK columns
--   pointing at product_groups/product_types, those two tables are
--   defined earlier in this file (section 3) than in the original
--   development history (where 009_catalogue_redesign.sql followed
--   002_store_schema.sql) — required so a fresh install's execution
--   order is valid; the resulting objects are identical.
--   RLS/policies for every table here live in 007_store_security_rls.sql
--   (kept separate so all security rules are auditable in one place).
--   Seed rows live in 009_seed_and_configuration.sql.
-- ════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════
-- 1. CATEGORIES — two-level hierarchy (top-level → subcategory)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_categories (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid references public.store_categories(id) on delete set null,
  slug          text not null unique,
  name          text not null,
  description   text not null default '',
  icon_key      text not null default 'Tag',
  image_url     text,
  sort_order    int not null default 0,
  is_active     boolean not null default true,
  is_featured   boolean not null default false, -- 007_phase9_features.sql
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists store_categories_parent_idx on public.store_categories (parent_id);
create index if not exists store_categories_slug_idx   on public.store_categories (slug);

-- ════════════════════════════════════════════════════════════════════════
-- 2. BRANDS
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
-- 3. PRODUCT GROUPS & TYPES (009_catalogue_redesign.sql)
-- Structured replacement for the free-text user_category / category
-- fields — the DB is the source of truth, not the CSV. Defined before
-- store_products because store_products FKs into these two tables.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.product_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon_key    text not null default 'Tag',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists product_groups_slug_idx on public.product_groups (slug);

create table if not exists public.product_types (
  id               uuid primary key default gen_random_uuid(),
  name             text not null unique,
  slug             text not null unique,
  product_group_id uuid references public.product_groups(id) on delete set null,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists product_types_group_idx on public.product_types (product_group_id);
create index if not exists product_types_slug_idx  on public.product_types (slug);

-- ════════════════════════════════════════════════════════════════════════
-- 4. PRODUCTS
-- One product can have many variants; prices/stock/SKUs live on variants.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_products (
  id               uuid primary key default gen_random_uuid(),

  -- Identity
  name             text not null,
  slug             text not null unique,
  brand_id         uuid references public.store_brands(id) on delete set null,
  category_id      uuid references public.store_categories(id) on delete set null,

  -- Content
  short_description  text not null default '',
  full_description   text not null default '',
  usage_info         text not null default '',
  ingredients        text not null default '',
  warnings           text not null default '',

  images           text[] not null default '{}',
  tags             text[] not null default '{}',
  health_goal_tags text[] not null default '{}',

  -- Health / nutrition metadata (per serving)
  serving_size_label   text not null default '',
  serving_size_g       numeric,
  calories_per_serving numeric,
  protein_per_serving  numeric,
  carbs_per_serving    numeric,
  fat_per_serving      numeric,
  fibre_per_serving    numeric,
  sodium_per_serving   numeric,
  sugar_per_serving    numeric,

  published        boolean not null default false,

  -- 'active' visible+purchasable | 'inactive' admin-only |
  -- 'out_of_stock' visible, not purchasable | 'discontinued' kept for history
  availability     text not null default 'active'
                   check (availability in ('active','inactive','out_of_stock','discontinued')),

  rating_average   numeric(3,2) not null default 0,
  rating_count     int not null default 0,

  sort_order       int not null default 0,
  is_featured      boolean not null default false,

  -- 008_product_type_and_categories.sql: fine-grained "Type" field, a
  -- further filtration option shown under the broad Category on the
  -- storefront (e.g. "Whey Protein", "Creatine"). Free text, admin-controlled.
  product_type     text not null default '',

  -- 008_product_type_and_categories.sql: catalog provenance — lets the
  -- admin Catalog browser show "Already in store" for catalog entries
  -- that have been imported. Informational/traceability only.
  catalog_source_id text,

  -- 009_catalogue_redesign.sql: structured group/type (replaces the
  -- free-text product_type as the source of truth going forward).
  product_group_id uuid references public.product_groups(id) on delete set null,
  product_type_id  uuid references public.product_types(id)  on delete set null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists store_products_category_idx    on public.store_products (category_id);
create index if not exists store_products_brand_idx       on public.store_products (brand_id);
create index if not exists store_products_slug_idx        on public.store_products (slug);
create index if not exists store_products_published_idx   on public.store_products (published, availability);
create index if not exists store_products_featured_idx    on public.store_products (is_featured) where is_featured = true;
create index if not exists store_products_type_idx        on public.store_products (product_type);
create index if not exists store_products_catalog_source_idx on public.store_products (catalog_source_id);
create index if not exists store_products_group_idx        on public.store_products (product_group_id);
create index if not exists store_products_ptype_idx        on public.store_products (product_type_id);

comment on column public.store_products.product_type is
  'Fine-grained product type (e.g. "Whey Protein", "Creatine"). Further filtration option shown under the broad Category (category_id) on the storefront. Free text, admin-controlled.';
comment on column public.store_products.catalog_source_id is
  'Catalog product_id (e.g. "CAT-0001") this product was imported from, if any. Informational/traceability only — editing the store product does not sync back to the catalog.';

-- Full-text search index over name + description
create index if not exists store_products_fts_idx on public.store_products
  using gin(to_tsvector('english', name || ' ' || coalesce(short_description,'') || ' ' || coalesce(full_description,'')));

-- ════════════════════════════════════════════════════════════════════════
-- 5. PRODUCT VARIANTS
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_product_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references public.store_products(id) on delete cascade not null,

  sku             text not null unique,
  name            text not null default '',
  size_label      text not null default '',
  flavour         text not null default '',
  color           text not null default '',

  price_paise     bigint not null,
  compare_price_paise bigint,

  stock_quantity  int not null default 0,
  low_stock_threshold int not null default 5,

  images          text[] not null default '{}',

  availability    text not null default 'active'
                  check (availability in ('active','inactive','out_of_stock','discontinued')),

  is_default      boolean not null default false,
  sort_order      int not null default 0,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists store_variants_product_idx on public.store_product_variants (product_id);
create index if not exists store_variants_sku_idx     on public.store_product_variants (sku);

-- ════════════════════════════════════════════════════════════════════════
-- 6. PRODUCT–CATEGORY JUNCTION
-- A product can appear in multiple categories; the primary category is on
-- the product row itself (category_id above), extras go here.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.store_product_categories (
  product_id  uuid references public.store_products(id) on delete cascade not null,
  category_id uuid references public.store_categories(id) on delete cascade not null,
  primary key (product_id, category_id)
);

-- ════════════════════════════════════════════════════════════════════════
-- 7. PRODUCT CATALOGUE (DB source of truth for the master catalogue,
--    populated in bulk by 010_seed_groups_types_from_catalogue.sql)
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.product_catalogue (
  id                   uuid primary key default gen_random_uuid(),
  product_id           text not null unique,
  product_name         text not null,
  slug                 text not null unique,
  brand                text not null default '',

  product_group_id     uuid references public.product_groups(id) on delete set null,
  product_type_id      uuid references public.product_types(id)  on delete set null,

  goal_tags            text[] not null default '{}',
  aim_tags             text[] not null default '{}',
  search_tags          text[] not null default '{}',

  short_description    text not null default '',
  full_description     text not null default '',
  usage_information    text not null default '',
  ingredients          text not null default '',
  warnings_allergens   text not null default '',

  image_urls           text[] not null default '{}',

  serving_size_label   text not null default '',
  serving_size_g       numeric,
  calories             numeric,
  protein_g            numeric,
  carbohydrates_g      numeric,
  fat_g                numeric,
  fibre_g              numeric,
  sugar_g              numeric,
  sodium_mg            numeric,

  product_status       text not null default 'draft',
  sort_order           int  not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists product_catalogue_product_id_idx on public.product_catalogue (product_id);
create index if not exists product_catalogue_group_idx      on public.product_catalogue (product_group_id);
create index if not exists product_catalogue_type_idx       on public.product_catalogue (product_type_id);

create table if not exists public.product_catalogue_variants (
  id                    uuid primary key default gen_random_uuid(),
  catalogue_id          uuid references public.product_catalogue(id) on delete cascade not null,
  variant_id            text not null,
  sku                   text not null,
  variant_name          text not null default '',
  size_weight           text not null default '',
  flavour               text not null default '',
  colour                text not null default '',
  variant_status        text not null default 'active',
  suggested_price_inr   numeric,
  compare_at_price_inr  numeric,
  stock_quantity        int  not null default 0,
  low_stock_threshold   int  not null default 5,
  is_default_variant    boolean not null default false,
  calories              numeric,
  protein_g             numeric,
  carbohydrates_g       numeric,
  fat_g                 numeric,
  fibre_g               numeric,
  sugar_g               numeric,
  sodium_mg             numeric,
  serving_size_label    text,
  serving_size_g        numeric,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
  -- NOTE: the UNIQUE (catalogue_id, variant_id) constraint required for the
  -- ON CONFLICT upserts in 010_seed_groups_types_from_catalogue.sql is
  -- added by that file itself (via a guarded DO block) — 010 is immutable
  -- per the consolidation brief, so it is intentionally not duplicated
  -- here. See CONSOLIDATION_REPORT.md.
);

create index if not exists catalogue_variants_catalogue_idx on public.product_catalogue_variants (catalogue_id);

-- ════════════════════════════════════════════════════════════════════════
-- 8. CASCADE-RENAME FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.rename_product_group(p_id uuid, p_new_name text, p_new_slug text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.product_groups
  set name = p_new_name, slug = p_new_slug, updated_at = now()
  where id = p_id;
end;
$$;

create or replace function public.rename_product_type(p_id uuid, p_new_name text, p_new_slug text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.product_types
  set name = p_new_name, slug = p_new_slug, updated_at = now()
  where id = p_id;
  update public.store_products
  set product_type = p_new_name, updated_at = now()
  where product_type_id = p_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 9. UPDATED_AT TRIGGERS (uses public.set_updated_at() from 001)
-- ════════════════════════════════════════════════════════════════════════

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

drop trigger if exists product_groups_updated_at on public.product_groups;
create trigger product_groups_updated_at
  before update on public.product_groups
  for each row execute procedure public.set_updated_at();

drop trigger if exists product_types_updated_at on public.product_types;
create trigger product_types_updated_at
  before update on public.product_types
  for each row execute procedure public.set_updated_at();

drop trigger if exists product_catalogue_updated_at on public.product_catalogue;
create trigger product_catalogue_updated_at
  before update on public.product_catalogue
  for each row execute procedure public.set_updated_at();

drop trigger if exists catalogue_variants_updated_at on public.product_catalogue_variants;
create trigger catalogue_variants_updated_at
  before update on public.product_catalogue_variants
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- 10. REALTIME — subscribe to catalog changes in the storefront
-- ════════════════════════════════════════════════════════════════════════

do $$ begin alter publication supabase_realtime add table public.store_categories; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_products; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_product_variants; exception when duplicate_object then null; end $$;
