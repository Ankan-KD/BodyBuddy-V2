-- ════════════════════════════════════════════════════════════════════════
-- 008 — Product Type + additional broad Categories
-- Run this in your Supabase SQL editor AFTER 002_store_schema.sql has been
-- applied. Safe to re-run: all statements use IF NOT EXISTS / ON CONFLICT.
--
-- Context: admin-facing "Category" (store_categories, via category_id) is
-- the BROAD category customers actually browse on the storefront
-- (e.g. "Protein", "Vitamins"). This migration adds a separate, more
-- fine-grained "Type" field (product_type) — a further filtration option
-- shown under Category on the storefront (e.g. "Whey Protein", "Creatine").
-- Nothing existing is removed or renamed at the database level.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Add product_type to store_products ──────────────────────────────
alter table public.store_products
  add column if not exists product_type text not null default '';

create index if not exists store_products_type_idx on public.store_products (product_type);

comment on column public.store_products.product_type is
  'Fine-grained product type (e.g. "Whey Protein", "Creatine"). Further filtration option shown under the broad Category (category_id) on the storefront. Free text, admin-controlled.';

-- ── 2. Seed additional broad top-level categories ──────────────────────
-- These cover catalog types that don't fit the original 002 seed list
-- (e.g. Mass Gainer / Weight Management, Joint & Recovery, Digestive
-- Health, Ayurvedic & Herbal products from the product_catalog.csv
-- user_category column).
insert into public.store_categories (slug, name, description, icon_key, sort_order)
values
  ('weight-management', 'Weight Management', 'Mass gainers and weight management support', 'Scale',    11),
  ('joint-recovery',     'Joint & Recovery',   'Glucosamine, collagen joint support, recovery aids', 'Activity', 12),
  ('digestive-health',   'Digestive Health',   'Probiotics, fibre, digestive enzymes',     'Leaf',     13),
  ('ayurvedic-herbal',   'Ayurvedic & Herbal', 'Traditional herbal and Ayurvedic supplements', 'Leaf',  14)
on conflict (slug) do nothing;

-- ── 3. Track catalog provenance ─────────────────────────────────────────
-- Lets the admin Catalog browser show "Already in store" for catalog
-- entries that have been imported, instead of silently allowing duplicate
-- imports with no visibility.
alter table public.store_products
  add column if not exists catalog_source_id text;

create index if not exists store_products_catalog_source_idx on public.store_products (catalog_source_id);

comment on column public.store_products.catalog_source_id is
  'Catalog product_id (e.g. "CAT-0001") this product was imported from, if any. Informational/traceability only — editing the store product does not sync back to the catalog.';

