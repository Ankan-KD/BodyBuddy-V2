-- ════════════════════════════════════════════════════════════════════════
-- 001 — Extensions & Shared Utility Functions
--
-- Foundational, cross-cutting setup used by every other file in this
-- project. Run this first on a fresh Supabase/Postgres project.
--
-- CONSOLIDATION NOTE (production cleanup, see /supabase/CONSOLIDATION_REPORT.md):
--   `pgcrypto` was declared redundantly in three historical files
--   (001_core_schema.sql, 002_store_schema.sql, 013_password_otp_secure.sql).
--   `public.set_updated_at()` was defined identically three times
--   (002_store_schema.sql, 004_store_cart.sql, 007_phase9_features.sql) —
--   same body, same behavior, just re-declared with CREATE OR REPLACE each
--   time a new feature file needed it. Both are consolidated to a single
--   authoritative definition here. No behavior changes.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Shared "touch updated_at" trigger function ──────────────────────────
-- Attached (in the schema files below) to every table that carries an
-- updated_at column: store_categories, store_products, store_product_variants,
-- store_cart_items, store_orders, store_offers, product_groups, product_types,
-- product_catalogue, product_catalogue_variants, store_delivery_profiles.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
