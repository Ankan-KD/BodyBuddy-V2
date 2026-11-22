-- ════════════════════════════════════════════════════════════════════════
-- 004 — BB Store: catalog schema
-- Depends on: 001
--
--   store_categories           two-level category tree (storefront navigation)
--   store_brands               brands
--   product_groups / types     structured catalogue taxonomy
--   store_products             live sellable products
--   store_product_variants     sizes/flavours with price, SKU and stock
--   store_product_categories   extra categories per product
--   product_catalogue (+variants)  master template library an admin imports from
--
-- store_products is the live store; product_catalogue is only the import
-- source (store_products.catalog_source_id records provenance, nothing more).
-- Policies are in 007; seed data in 009 / 010.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Categories ───────────────────────────────────────────────────────
create table if not exists public.store_categories (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.store_categories(id) on delete set null,
  slug         text not null unique,
  name         text not null,
  description  text not null default '',
  icon_key     text not null default 'Tag',
  image_url    text,
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  is_featured  boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists store_categories_parent_idx on public.store_categories (parent_id);

-- ── 2. Brands ───────────────────────────────────────────────────────────
create table if not exists public.store_brands (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  logo_url     text,
  website_url  text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── 3. Product groups & types ───────────────────────────────────────────
-- Group = broad (Protein, Vitamins); Type = fine-grained inside a group
-- (Whey Protein, Creatine). Defined before store_products, which references both.
create table if not exists public.product_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  icon_key    text not null default 'Tag',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.product_types (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  slug              text not null unique,
  product_group_id  uuid references public.product_groups(id) on delete set null,
  sort_order        int  not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists product_types_group_idx on public.product_types (product_group_id);

-- ── 4. Products ─────────────────────────────────────────────────────────
-- Price, SKU and stock live on the variants, not here.
create table if not exists public.store_products (
  id                   uuid primary key default gen_random_uuid(),

  name                 text not null,
  slug                 text not null unique,
  brand_id             uuid references public.store_brands(id)     on delete set null,
  category_id          uuid references public.store_categories(id) on delete set null,
  product_group_id     uuid references public.product_groups(id)   on delete set null,
  product_type_id      uuid references public.product_types(id)    on delete set null,

  short_description    text not null default '',
  full_description     text not null default '',
  usage_info           text not null default '',
  ingredients          text not null default '',
  warnings             text not null default '',

  images               text[] not null default '{}',
  tags                 text[] not null default '{}',
  health_goal_tags     text[] not null default '{}',

  -- Nutrition per serving
  serving_size_label   text not null default '',
  serving_size_g       numeric,
  calories_per_serving numeric,
  protein_per_serving  numeric,
  carbs_per_serving    numeric,
  fat_per_serving      numeric,
  fibre_per_serving    numeric,
  sodium_per_serving   numeric,
  sugar_per_serving    numeric,

  published            boolean not null default false,
  -- active: visible + purchasable | inactive: admin-only |
  -- out_of_stock: visible, not purchasable | discontinued: kept for history
  availability         text not null default 'active'
                       check (availability in ('active','inactive','out_of_stock','discontinued')),

  rating_average       numeric(3,2) not null default 0,
  rating_count         int not null default 0,
  sort_order           int not null default 0,
  is_featured          boolean not null default false,

  -- Display name of the product's type (kept in sync with product_types.name
  -- by rename_product_type()). product_type_id is the structured reference.
  product_type         text not null default '',
  -- Catalogue product_id (e.g. 'PROD-001') this product was imported from. Traceability only.
  catalog_source_id    text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists store_products_category_idx       on public.store_products (category_id);
create index if not exists store_products_brand_idx          on public.store_products (brand_id);
create index if not exists store_products_published_idx      on public.store_products (published, availability);
create index if not exists store_products_featured_idx       on public.store_products (is_featured) where is_featured = true;
create index if not exists store_products_type_idx           on public.store_products (product_type);
create index if not exists store_products_catalog_source_idx on public.store_products (catalog_source_id);
create index if not exists store_products_group_idx          on public.store_products (product_group_id);
create index if not exists store_products_ptype_idx          on public.store_products (product_type_id);

-- Full-text search over name + descriptions
create index if not exists store_products_fts_idx on public.store_products
  using gin (to_tsvector('english', name || ' ' || coalesce(short_description,'') || ' ' || coalesce(full_description,'')));

-- ── 5. Variants ─────────────────────────────────────────────────────────
create table if not exists public.store_product_variants (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid not null references public.store_products(id) on delete cascade,

  sku                  text not null unique,
  name                 text not null default '',
  size_label           text not null default '',
  flavour              text not null default '',
  color                text not null default '',

  price_paise          bigint not null,
  compare_price_paise  bigint,

  stock_quantity       int not null default 0,
  low_stock_threshold  int not null default 5,
  images               text[] not null default '{}',

  availability         text not null default 'active'
                       check (availability in ('active','inactive','out_of_stock','discontinued')),

  is_default           boolean not null default false,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Stock can never go negative, whatever the application does.
  constraint store_product_variants_stock_non_negative check (stock_quantity >= 0)
);

create index if not exists store_variants_product_idx on public.store_product_variants (product_id);

-- ── 6. Extra categories per product ─────────────────────────────────────
-- The primary category is store_products.category_id; additional ones go here.
create table if not exists public.store_product_categories (
  product_id   uuid not null references public.store_products(id)   on delete cascade,
  category_id  uuid not null references public.store_categories(id) on delete cascade,
  primary key (product_id, category_id)
);

-- ── 7. Master catalogue (import source, seeded by 010) ──────────────────
create table if not exists public.product_catalogue (
  id                   uuid primary key default gen_random_uuid(),
  product_id           text not null unique,       -- stable catalogue id, e.g. 'PROD-001'
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

create index if not exists product_catalogue_group_idx on public.product_catalogue (product_group_id);
create index if not exists product_catalogue_type_idx  on public.product_catalogue (product_type_id);

create table if not exists public.product_catalogue_variants (
  id                    uuid primary key default gen_random_uuid(),
  catalogue_id          uuid not null references public.product_catalogue(id) on delete cascade,
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
  updated_at            timestamptz not null default now(),

  -- Required by the upserts in 010_seed_product_catalogue.sql
  constraint uq_catalogue_variants_catalogue_variant unique (catalogue_id, variant_id)
);

create index if not exists catalogue_variants_catalogue_idx on public.product_catalogue_variants (catalogue_id);

-- ── 8. Rename helpers ───────────────────────────────────────────────────
create or replace function public.rename_product_group(p_id uuid, p_new_name text, p_new_slug text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.product_groups
     set name = p_new_name, slug = p_new_slug
   where id = p_id;
end;
$$;

-- Renames a type and refreshes the denormalised store_products.product_type text.
create or replace function public.rename_product_type(p_id uuid, p_new_name text, p_new_slug text)
returns void
language plpgsql
set search_path = public
as $$
begin
  update public.product_types
     set name = p_new_name, slug = p_new_slug
   where id = p_id;
  update public.store_products
     set product_type = p_new_name
   where product_type_id = p_id;
end;
$$;

-- ── 9. updated_at triggers ──────────────────────────────────────────────
drop trigger if exists store_categories_updated_at on public.store_categories;
create trigger store_categories_updated_at before update on public.store_categories
  for each row execute procedure public.set_updated_at();

drop trigger if exists store_products_updated_at on public.store_products;
create trigger store_products_updated_at before update on public.store_products
  for each row execute procedure public.set_updated_at();

drop trigger if exists store_variants_updated_at on public.store_product_variants;
create trigger store_variants_updated_at before update on public.store_product_variants
  for each row execute procedure public.set_updated_at();

drop trigger if exists product_groups_updated_at on public.product_groups;
create trigger product_groups_updated_at before update on public.product_groups
  for each row execute procedure public.set_updated_at();

drop trigger if exists product_types_updated_at on public.product_types;
create trigger product_types_updated_at before update on public.product_types
  for each row execute procedure public.set_updated_at();

drop trigger if exists product_catalogue_updated_at on public.product_catalogue;
create trigger product_catalogue_updated_at before update on public.product_catalogue
  for each row execute procedure public.set_updated_at();

drop trigger if exists catalogue_variants_updated_at on public.product_catalogue_variants;
create trigger catalogue_variants_updated_at before update on public.product_catalogue_variants
  for each row execute procedure public.set_updated_at();

-- ── 10. Realtime — storefront reacts to catalog changes ─────────────────
do $$ begin alter publication supabase_realtime add table public.store_categories;       exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_products;         exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.store_product_variants; exception when duplicate_object then null; end $$;
