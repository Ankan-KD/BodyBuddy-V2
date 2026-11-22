# Data files

Everything in this folder is **CSV**. There is no JSON copy, no generate/build
step, and nothing derived to keep in sync: edit a CSV and that is the change.

| File | What it is | How the app uses it | How you update it |
|---|---|---|---|
| `master-food-database.source.csv` | Food nutrition reference (3,611 rows) | Bundled into the app at build time; parsed on first use by `src/lib/masterFoods.ts` | Edit the CSV, redeploy |
| `product_catalog.csv` | Master product catalogue (332 products, 429 variants) | Not read at runtime; loaded into the database by the admin importer | Edit the CSV, upload it at **/admin/catalog → Import CSV** (no redeploy) |

Both are read by the same small reader, `src/lib/csv.ts`, which copes with
Excel/Sheets exports: quoted fields, commas and line breaks inside quotes,
CRLF or LF, and the UTF-8 BOM that Excel's "CSV UTF-8" adds.

---

## Master Food Database

`master-food-database.source.csv` is the single source of truth for the food
reference data. `src/lib/masterFoods.ts` imports it as text (`next.config.mjs`
configures the loader for Turbopack and webpack), parses it the first time
something needs it, and builds the search indexes. The app never writes to it:
nothing at runtime — not a user, the AI, or a bug — can change it. It changes
only when you change the file and redeploy.

It powers: the "Add to Diet" and manual-log food pickers, onboarding
suggestions, and grounding for the AI food chat (so estimates come from real
data, and the no-Gemini fallback can recognise common dishes).

### Columns

| Column | Meaning |
|---|---|
| `id` | Stable numeric row id. New rows get the next unused id — never reuse or renumber, because onboarding suggestions (`ONBOARDING_SUGGESTION_CONFIG` in `masterFoods.ts`) refer to rows by id. |
| `category` / `subcategory` | This app's grouping, e.g. `Indian Meals` / `Rice Dishes`. |
| `food_name` | Canonical display name. **Required.** |
| `local_name` | Regional/vernacular name in its own column (e.g. `food_name` "Split Bengal Gram Dal", `local_name` "Channa Dal"). Blank if none. Optional column. |
| `aliases` | Comma-separated alternate spellings people might type. Matching also does a phonetic fallback (z/j, w/v, ph/f, doubled letters, silent h — see `normalizeForMatch`), so you don't need every spelling variant. |
| `serving_size` / `serving_unit` / `weight_g` | What the nutrition columns are "per": `g`/`ml` with a gram weight, or a named unit (`bowl`, `piece`, …) with `weight_g` as its approximate gram equivalent. |
| `calories_kcal`, `protein_g`, `carbohydrates_g`, `fat_g`, `dietary_fiber_g`, `free_sugars_g`, `saturated_fat_g`, `sodium_mg`, `cholesterol_mg` | Nutrition for that serving. A blank cell counts as 0. (`total_sugars_g` or `sugar_g` are also accepted in place of `free_sugars_g`.) |
| `food_type` | `Meals / Prepared Food` vs `Raw`. |
| `ingredients` | Comma-separated real ingredients of a composite dish (Chicken Biryani → `Rice, Chicken, Yogurt, Onion, Spices`). Grounds the AI's "does this dish match a Diet item" check in real data. Leave blank for single-ingredient foods. Optional column. |
| `source` | Optional provenance: e.g. `INDB` for rows merged from the [Indian Nutrient Databank](https://github.com/abhijeet-genome/Indian-Nutrient-Databank-INDB-). Add a new value whenever you merge another dataset. The app ignores this column. |

Extra columns the app doesn't know about are ignored, so you can keep your own
notes in the CSV.

### Editing by hand

Open the CSV in Excel/Sheets/any editor, change rows, save as CSV, redeploy.
If a row is malformed (missing `id` or `food_name`, or a repeated `id`) the app
skips just that row and logs a one-line warning with the line number to the
console, instead of failing.

### Merging in another dataset (automated)

`scripts/merge_indb.py` is the worked example (INDB). It dedupes against
existing names/aliases, splits "English Name (Local Name)", tags new rows with
a `source`, and writes the CSV back **keeping the file's existing columns** —
it never drops `ingredients` or renames anything. Run from the project root:

```bash
pip install pandas openpyxl
python3 scripts/merge_indb.py      # edit INDB_PATH at the top first
git diff src/data/master-food-database.source.csv   # review, then redeploy
```

To merge a different dataset, copy that script and follow the same rules:
1. Normalise each incoming name the same way as `normalizeForMatch` in
   `src/lib/masterFoods.ts` and check it against existing `food_name` +
   `local_name` + `aliases` first, so you don't add a duplicate under another
   spelling.
2. Split any "English Name (Local Name)" into `food_name` + `local_name`.
3. Only add genuinely new rows (or merge a new alias into the existing row).
4. Give new rows the next unused `id` and a `source` value.

### If you later want updates without a redeploy

Because the file ships inside the app, changing it needs a redeploy. If you
ever want to upload it from the admin portal instead, it would have to live in
a database table (e.g. `master_foods`: RLS on, a `select` policy for
`authenticated`/`anon`, and **no** insert/update/delete policies, so only the
service-role key can write). That is a bigger change than the current setup
needs, so it isn't done today.

---

## Product Catalogue

`product_catalog.csv` is the master product catalogue, one row per variant.
It is the **source of truth** for the catalogue; the admin importer loads it
into the database.

```
product_catalog.csv
   │  /admin/catalog → "Import CSV"
   ▼
product_catalogue + product_catalogue_variants      ← the admin's browsable library
   │  admin clicks "Add to Store"
   ▼
/admin/products/new (prefilled) → review name, images, price, stock → Save
   ▼
store_products + store_product_variants             ← the live store
```

### How the import behaves

- **Safe to re-run.** It adds new products and updates existing ones, matched on
  `product_id` (products) and `product_id` + `variant_id` (variants).
- **Never deletes.** A product removed from the CSV stays in the database until
  an admin removes it.
- **Overwrites catalogue edits.** Because the CSV is the source of truth, fields
  edited inline on /admin/catalog are replaced by the CSV's values the next time
  that product is imported.
- **Existing groups and types are left alone.** Names in the CSV that don't
  exist yet are created; ones that do keep their icon, order and slug.
- **Store products are never touched.** Once saved to the store, price, stock and
  publish state live in `store_products` / `store_product_variants` only.
  `store_products.catalog_source_id` records the catalogue `product_id` for
  traceability.
- **Checked before it runs.** The admin page reads the file as soon as you pick
  it and tells you if it isn't a catalogue CSV (missing `product_id` /
  `product_name`), or how many products and variants it found. Problems during
  the import are listed by `product_id`; a bad product doesn't stop the rest.
- **Needs a store-admin login** (`user_security.is_store_admin`), per the RLS
  policies in `supabase new/007_store_security_rls.sql`. The tables come from
  `supabase new/004_store_catalog_schema.sql`.

> `supabase new/010_seed_product_catalogue.sql` is a one-time SQL snapshot of
> this CSV for first-time database setup. It does **not** update itself — after
> editing the CSV, use the admin import (above) rather than re-running it.

### CSV columns

| Column | Purpose |
|---|---|
| `product_id` | Stable catalogue id (e.g. `PROD-001`). Never reuse or renumber. **Required.** |
| `product_name` | Display name. **Required.** |
| `slug` | URL-safe slug; generated from the name if blank. Must be unique. |
| `brand` | Brand name |
| `user_category` | **Product group** — broad, customer-facing (`Protein`, `Vitamins`) |
| `category` | **Product type** — fine-grained inside a group (`Whey Protein`, `Creatine`) |
| `short_description` / `full_description` | Summary and body text |
| `product_status` | Catalogue-level status (`draft` / `active`; defaults to `active` if blank) |
| `sort_order` | Display order in the catalogue browser |
| `goals` | Broad goals, comma-separated (`Muscle Building, Weight Loss`), turned into storefront goal tags (`muscle-building`, …) |
| `aim`, `search_tags` | Comma-separated detailed aims and search keywords |
| `primary_image_url`, `image_url_2` … `image_url_5` | Images |
| `serving_size_label`, `serving_size_g` | e.g. `1 scoop (30g)`, `30` |
| `calories`, `protein_g`, `carbohydrates_g`, `fat_g`, `fibre_g`, `sugar_g`, `sodium_mg` | Per-serving nutrition |
| `usage_information`, `ingredients`, `warnings_allergens` | Directions, ingredient list, allergen text |
| `variant_id`, `sku`, `variant_name` | Stable variant id, suggested SKU, e.g. `1kg – Chocolate` |
| `size_weight`, `flavour`, `colour` | Variant attributes (blank when not applicable) |
| `variant_status` | Variant status (defaults to `active` if blank) |
| `price_inr`, `compare_at_price_inr` | **Suggested** price and strikethrough price in ₹ (admin sets the real price when adding to the store) |
| `stock_quantity`, `low_stock_threshold` | Suggested initial stock and alert level |
| `is_default_variant` | `true` / `false` (Excel's `TRUE`/`FALSE` is fine) |
| `variant_calories`, `variant_protein_g`, … | Optional per-variant nutrition overrides (not in the current file) |
| `created_at`, `updated_at`, `variant_count`, `variant_options`, `goal_tags` | Present in the file but ignored by the importer (derived or informational) |

### Adding catalogue products

One product spans **multiple rows** — one per variant, all sharing the same
`product_id`. Product-level fields are read from the **first row** of each
product; leave them blank on later rows. A repeated `variant_id` within one
product is reported and only the first row is used.
