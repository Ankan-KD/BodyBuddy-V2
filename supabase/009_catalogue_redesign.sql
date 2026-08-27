-- ════════════════════════════════════════════════════════════════════════
-- 009 — Product Catalogue Redesign
--
-- Goals:
--   1. Create a standalone `product_catalogue` table (DB is source of truth)
--   2. Add `product_group` and `product_type` tables (replaces hardcoded values)
--   3. Rename terminology: user_category → product_group, category → product_type
--   4. Add product_group_id + product_type_id FK columns to store_products
--   5. Cascade-rename: updating a group/type propagates everywhere
--
-- Safe to re-run (all use IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Product Groups table (was: user_category) ─────────────────────────
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

-- ── 2. Product Types table (was: category) ───────────────────────────────
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

-- ── 3. Product Catalogue table (DB source of truth, not the CSV) ─────────
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

-- ── 4. Catalogue Variants table ──────────────────────────────────────────
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
);

create index if not exists catalogue_variants_catalogue_idx on public.product_catalogue_variants (catalogue_id);

-- ── 5. Add product_group_id + product_type_id to store_products ──────────
alter table public.store_products
  add column if not exists product_group_id uuid references public.product_groups(id) on delete set null,
  add column if not exists product_type_id  uuid references public.product_types(id)  on delete set null;

create index if not exists store_products_group_idx on public.store_products (product_group_id);
create index if not exists store_products_ptype_idx on public.store_products (product_type_id);

-- ── 6. Cascade-rename function for product groups ────────────────────────
create or replace function public.rename_product_group(p_id uuid, p_new_name text, p_new_slug text)
returns void language plpgsql as $$
begin
  update public.product_groups
  set name = p_new_name, slug = p_new_slug, updated_at = now()
  where id = p_id;
end;
$$;

-- ── 7. Cascade-rename function for product types ─────────────────────────
create or replace function public.rename_product_type(p_id uuid, p_new_name text, p_new_slug text)
returns void language plpgsql as $$
begin
  update public.product_types
  set name = p_new_name, slug = p_new_slug, updated_at = now()
  where id = p_id;
  update public.store_products
  set product_type = p_new_name, updated_at = now()
  where product_type_id = p_id;
end;
$$;

-- ── 8. RLS ────────────────────────────────────────────────────────────────
-- PostgreSQL does NOT support "CREATE POLICY IF NOT EXISTS".
-- The correct safe-to-re-run pattern is: DROP POLICY IF EXISTS, then CREATE POLICY.
-- Reads are open to everyone; writes are restricted to store admins.

alter table public.product_groups             enable row level security;
alter table public.product_types              enable row level security;
alter table public.product_catalogue          enable row level security;
alter table public.product_catalogue_variants enable row level security;

-- product_groups
drop policy if exists "product_groups_read"         on public.product_groups;
drop policy if exists "product_groups_all"          on public.product_groups;
drop policy if exists "product_groups_admin_write"  on public.product_groups;

create policy "product_groups_read" on public.product_groups
  for select using (true);

create policy "product_groups_admin_write" on public.product_groups
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

-- product_types
drop policy if exists "product_types_read"        on public.product_types;
drop policy if exists "product_types_all"         on public.product_types;
drop policy if exists "product_types_admin_write" on public.product_types;

create policy "product_types_read" on public.product_types
  for select using (true);

create policy "product_types_admin_write" on public.product_types
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

-- product_catalogue
drop policy if exists "catalogue_read"         on public.product_catalogue;
drop policy if exists "catalogue_all"          on public.product_catalogue;
drop policy if exists "catalogue_admin_write"  on public.product_catalogue;

create policy "catalogue_read" on public.product_catalogue
  for select using (true);

create policy "catalogue_admin_write" on public.product_catalogue
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

-- product_catalogue_variants
drop policy if exists "catalogue_var_read"        on public.product_catalogue_variants;
drop policy if exists "catalogue_var_all"         on public.product_catalogue_variants;
drop policy if exists "catalogue_var_admin_write" on public.product_catalogue_variants;

create policy "catalogue_var_read" on public.product_catalogue_variants
  for select using (true);

create policy "catalogue_var_admin_write" on public.product_catalogue_variants
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

-- ── 9. Updated-at triggers ────────────────────────────────────────────────
-- set_updated_at() is already defined (create or replace) in 002_store_schema.sql.

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
