-- ════════════════════════════════════════════════════════════════════════
-- 009 — Seed & Configuration Data
-- Depends on: 004_store_catalog_schema.sql, 005_store_commerce_schema.sql
--
-- Lightweight, hand-written seed data (starter categories, a sample brand,
-- default store settings) — all idempotent (ON CONFLICT DO NOTHING).
-- Gives the store something to show immediately after schema setup; all
-- products start unpublished so nothing leaks to customers until an admin
-- explicitly publishes them.
--
-- The large, generated 332-product/429-variant catalogue seed
-- (010_seed_groups_types_from_catalogue.sql) is a separate, immutable file
-- per the consolidation brief and is NOT merged into this one.
-- ════════════════════════════════════════════════════════════════════════

-- ── Top-level categories (002_store_schema.sql + 008_product_type_and_categories.sql) ──
insert into public.store_categories (slug, name, description, icon_key, sort_order)
values
  ('protein',            'Protein',            'Whey, casein, plant-based and more',                'Dumbbell', 1),
  ('fat-burners',        'Fat Burners',        'Thermogenics, CLA, L-Carnitine',                    'Flame',    2),
  ('organic',            'Organic',            'Certified organic, whole food nutrition',           'Leaf',     3),
  ('vitamins',           'Vitamins',           'Multivitamins, vitamin D, B12 and more',             'Pill',     4),
  ('pre-workout',        'Pre-Workout',        'Energy, focus and endurance boosters',               'Zap',      5),
  ('health-foods',       'Health Foods',       'Superfoods, protein bars, clean snacks',             'Apple',    6),
  ('heart-health',       'Heart Health',       'Omega-3, CoQ10, Magnesium',                          'Heart',    7),
  ('hydration',          'Hydration',          'Electrolytes, hydration mixes',                      'Droplets', 8),
  ('sleep-recovery',     'Sleep & Recovery',   'Melatonin, magnesium, adaptogens',                   'Moon',     9),
  ('performance',        'Performance',        'Creatine, BCAA, amino acids',                        'Activity', 10),
  ('weight-management',  'Weight Management',  'Mass gainers and weight management support',         'Scale',    11),
  ('joint-recovery',     'Joint & Recovery',   'Glucosamine, collagen joint support, recovery aids', 'Activity', 12),
  ('digestive-health',   'Digestive Health',   'Probiotics, fibre, digestive enzymes',               'Leaf',     13),
  ('ayurvedic-herbal',   'Ayurvedic & Herbal', 'Traditional herbal and Ayurvedic supplements',       'Leaf',     14)
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

-- ── Store settings defaults (007_phase9_features.sql) ────────────────────
insert into public.store_settings (key, value) values
  ('store_name',          'BB Store'),
  ('store_tagline',       'Fuel Your Goals'),
  ('store_announcement',  ''),
  ('store_announcement_active', 'false'),
  ('maintenance_mode',    'false'),
  ('featured_category_ids', '[]')
on conflict (key) do nothing;

-- ── Return-address settings for shipping labels (011_razorpay_and_delivery.sql) ──
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
