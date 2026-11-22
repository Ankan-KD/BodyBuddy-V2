# BodyBuddy — Database (Supabase / Postgres)

This folder is the complete database for BodyBuddy: **BB Health** (nutrition
tracking) and **BB Store** (e-commerce). It is a clean, final-state set of
11 files — each file owns one concern and nothing is created in one file and
then altered or undone in another.

- **31 tables**, all with Row Level Security (RLS) enabled
- **43 policies**, **2 views**, **16 functions**, **17 triggers**
- Verified by running all 11 files, in order, on a real PostgreSQL 16 with
  Supabase's `auth` schema and roles mocked, twice (idempotency), followed by
  behaviour tests of the security rules, stock handling and order expiry.

---

## 1. Setup

### Fresh project
Open **Supabase → SQL Editor** and run the files **in numeric order**,
`001` → `011`. Every file is idempotent (`if not exists`, `or replace`,
`drop policy if exists`, `on conflict`), so re-running is safe.

| # | File | Concern |
|---|---|---|
| 001 | `001_extensions_and_shared_functions.sql` | `pgcrypto`, shared `set_updated_at()` trigger function |
| 002 | `002_core_health_schema.sql` | BB Health tables, constraints, dish-credit logic, RLS, realtime |
| 003 | `003_auth_and_security.sql` | `user_security` flags, OTP table, signup trigger, server-only auth helpers |
| 004 | `004_store_catalog_schema.sql` | Categories, brands, groups/types, products, variants, master catalogue |
| 005 | `005_store_commerce_schema.sql` | Cart, orders, order items, Razorpay ledger, addresses, wishlist, offers, settings, audit log |
| 006 | `006_store_order_automation.sql` | Atomic stock deduction, restore on cancel, order expiry, late-payment revive, `pg_cron` |
| 007 | `007_store_security_rls.sql` | Every store RLS policy, in one place |
| 008 | `008_store_views.sql` | Admin dashboard views (admin-only) |
| 009 | `009_store_seed_defaults.sql` | Starter categories, sample brand, default store settings |
| 010 | `010_seed_product_catalogue.sql` | 11 groups, 20 types, 332 catalogue products, 429 variants |
| 011 | `011_promote_store_admin.sql` | Make one user a store admin (edit the email first) |

Dependencies are strictly forward (a file only uses objects from lower
numbers), so the order above is the only valid one.

### Make yourself an admin
1. Sign up in the app normally.
2. Open `011_promote_store_admin.sql`, replace `mailid@gmail.com` with your email, run it in the SQL editor.
3. Log in at `/admin/login`.

### Existing database
If your database already went through the earlier step-by-step migrations
(including the `user_security` split and the `meal_combo_items`
normalisation) it is **already in this final state** — don't re-run
anything. These files are written for a fresh project. A database that never
received the later migrations should be rebuilt from these files rather than
patched.

### Do not
- Do **not** add an `INSERT` policy to `store_orders` / `store_order_items` (see §5).
- Do **not** add a write policy to `user_security` (see §3).
- Do **not** edit the `010` seed by hand — regenerate it from `src/data/product_catalog.csv`.

---

## 2. BB Health tables (`002`)

All tables are per-user. Policy rule on every one: `FOR ALL` where
`auth.uid() = user_id` (read, insert, update, delete only your own rows).

| Table | Purpose | Notable columns / rules |
|---|---|---|
| `user_settings` | One row per user: goals, profile, preferences | `goal_mode` (gain/lose/maintain), `calorie_goal`, `protein_goal`, `goal_weight_kg`, `start_weight_kg`, `water_goal_ml`, `units` (metric/imperial), `theme` (light/dark/system/princess), `gender`, `height_cm`, `onboarded`. Holds **no** security flags. |
| `foods` | The planned Diet / Today's Checklist | `kind` (binary/quantity), `unit` (g/ml/serving/count/oz), `category`, macros, `active_days` (0 = Sunday), `active_date` for one-off foods, `emoji` stores a lucide icon key |
| `day_logs` | Amount of each Diet food eaten per day | Unique `(user_id, date, food_id)`; `contributed_quantity` = part credited by dishes |
| `daily_water` | Water per day | PK `(user_id, date)` |
| `weight_entries` | Weight per day | Unique `(user_id, date)` |
| `recent_foods` | One-off foods eaten outside the Diet (pizza, biryani) | Same shape/constraints as `foods`; never recur, never in the checklist |
| `recent_food_logs` | Per-day history of eating a Recent Food | Unique `(user_id, date, recent_food_id)`; `mapped` = it credited Diet foods |
| `recent_food_log_contributions` | Which dish credited which Diet food, and how much | Unique `(recent_food_log_id, food_id)`; `quantity > 0` |
| `meal_combos` | Saved one-tap meal groups | name, icon, sort order |
| `meal_combo_items` | Items inside a combo | Real FKs; **exactly one** of `food_id` / `recent_food_id` is set (CHECK); cascades on delete |
| `milestones` | Unlocked achievements | PK `(user_id, key)`; insert-only by convention |

**Why `foods` and `recent_foods` are separate:** Recent Foods must never repeat
automatically or appear in Today's Checklist. A Recent Food becomes a Diet
food only when the user explicitly moves it (a new row in `foods`).

**CHECK constraints** enforce the allowed values listed above on
`user_settings`, `foods` and `recent_foods` at the database level.

**Extra RLS rules.** Tables that point at other user-owned rows also verify
ownership of the referenced rows on write, so nobody can attach another
user's data to their own:
- `meal_combo_items` — the combo, the food and the recent food must all belong to you.
- `recent_food_log_contributions` — the dish log and the Diet food must belong to you.

### Dish credits (traceable and reversible)
When a dish (e.g. biryani) credits a Diet food (rice), the credit is stored
as a row in `recent_food_log_contributions`.
- `add_dish_contribution(log_id, food_id, qty)` — records or adds to a credit. `SECURITY INVOKER`, so it runs under the caller's RLS; executable by `authenticated` only.
- `reverse_dish_contribution()` — trigger on **delete** of a contribution row; subtracts exactly that quantity from `day_logs.logged_quantity` and `contributed_quantity` (floored at 0). `SECURITY DEFINER` so it also works inside cascade deletes; no one can call it directly.
- Deleting a dish log or the dish therefore takes its credit back automatically.

---

## 3. Authentication & security (`003`)

### `user_security` — the one place for "powers" flags
| Column | Meaning |
|---|---|
| `is_store_admin` | Grants every admin policy in `007` and both views in `008` |
| `pending_email_verify` | Manual email signup whose OTP isn't verified yet (the app blocks the user until cleared) |
| `password_set` | User completed `/set-password` with a real password |

**Policy:** `read own security flags` — `SELECT` where `auth.uid() = user_id`.
There is **deliberately no insert/update/delete policy**, so the browser can
never change these. Only the service role, the SQL editor and `SECURITY
DEFINER` functions can write. This is why users cannot make themselves admin:
the flags are not in `user_settings` (which users can freely update).

### `password_otp_requests`
Custom 6-digit email OTP, verified entirely server-side.
- Columns: `email`, `purpose` (`change_password` / `set_password` / `forgot_password` / `signup_verify`), `code_hash`, `code_salt`, `attempts` / `max_attempts` (default 5), `expires_at`, `verify_token_hash` / `verify_expires_at`, `consumed`, `last_sent_at`; unique `(email, purpose)`.
- RLS is **enabled with no policies** → anon and authenticated keys are fully denied; only the service-role key (server API routes) can use it.

### Functions
| Function | Who may call | What it does |
|---|---|---|
| `handle_new_user()` | trigger on `auth.users` insert | Creates the user's `user_settings` row and `user_security` row in the same transaction. Manual signups (`signup_method = 'manual'` in auth metadata) start with `pending_email_verify = true`; Google sign-ins start verified. No one can call it as an RPC. |
| `user_has_password(uuid)` | service role | True if `auth.users.encrypted_password` is set |
| `get_auth_user_id_by_email(text)` | service role | Email → user id (forgot-password) |
| `user_pending_email_verify(uuid)` | service role | Reads the flag (false if no row) |
| `mark_password_set(uuid)` | service role | Sets `password_set = true` |

All helper functions are `SECURITY DEFINER` with a pinned `search_path` and
`EXECUTE` revoked from `public`, `anon` and `authenticated`.

---

## 4. BB Store tables (`004`, `005`)

### Catalog (`004`)
| Table | Purpose | Notes |
|---|---|---|
| `store_categories` | Two-level category tree | `parent_id`, unique `slug`, `icon_key`, `is_active`, `is_featured` |
| `store_brands` | Brands | unique `slug`, `is_active` |
| `product_groups` | Broad taxonomy (Protein, Vitamins…) | unique `name`/`slug` |
| `product_types` | Fine taxonomy inside a group (Whey Protein, Creatine…) | FK `product_group_id` |
| `store_products` | **Live** sellable products | `published`, `availability` (active / inactive / out_of_stock / discontinued), nutrition per serving, `images`, `tags`, `health_goal_tags`, group/type FKs, `product_type` display text, `catalog_source_id`, full-text GIN index on name + descriptions |
| `store_product_variants` | Sizes/flavours: price, SKU, stock | unique `sku`, `price_paise`, `stock_quantity` with `CHECK (stock_quantity >= 0)`, `low_stock_threshold`, `availability` |
| `store_product_categories` | Extra categories per product | PK `(product_id, category_id)`; primary category stays on `store_products.category_id` |
| `product_catalogue` | Master template library an admin imports from | unique `product_id` (e.g. `PROD-001`), tags, nutrition, `product_status` |
| `product_catalogue_variants` | Variants of a catalogue product | unique `(catalogue_id, variant_id)` (needed by the seed upserts), suggested price/stock |

`product_catalogue` is only the import source. After import, `store_products`
is independent; `catalog_source_id` records provenance and nothing more.
All prices are integers in **paise** (₹ × 100).

Helper functions: `rename_product_group(id, name, slug)` and
`rename_product_type(id, name, slug)` — the latter also refreshes the
denormalised `store_products.product_type` text.

### Commerce (`005`)
| Table | Purpose | Notes |
|---|---|---|
| `store_cart_items` | Per-user cart | `quantity > 0`; unique `(user_id, variant_id)` → one line per variant |
| `store_orders` | Orders | `order_number` (`BB-2026-00001`), customer/address **snapshots** (`delivery_address` jsonb), `payment_method`, `payment_status` (pending/paid/failed/refunded), Razorpay ids, `payment_error`, paise totals, `status` (placed → confirmed → processing → shipped → delivered; any → cancelled). Partial unique indexes on `razorpay_order_id` and `razorpay_payment_id` make payment handling idempotent. |
| `store_order_items` | Line items | Name, SKU, image and price **snapshotted** at purchase; product/variant FKs become `NULL` if later deleted |
| `store_razorpay_events` | Webhook idempotency ledger | PK `event_id`; server-only |
| `store_delivery_profiles` | Saved addresses (store only, separate from BB Health) | `label`, `is_default`; a trigger keeps **one default per user** (saving a new default clears the old one) |
| `store_wishlist_items` | Wishlist | unique `(user_id, product_id)` |
| `store_offers` | Discount codes | `percentage` / `fixed_paise`, validity window, `min_order_paise`, `max_uses`, `used_count`, `product_ids uuid[]` (empty = sitewide) |
| `store_settings` | Key/value store settings | see defaults in `009` |
| `admin_audit_log` | Admin login/action events | `event_type`, `metadata` jsonb |

`generate_order_number()` uses the `store_order_number_seq` sequence; it is
callable only by the service role (checkout API).

---

## 5. Order automation (`006`)

Stock is **held when the order is created** (before payment), so abandoned
checkouts must be released.

| Object | Type | Behaviour |
|---|---|---|
| `deduct_inventory_on_order` → `trg_deduct_inventory` | trigger, after insert on `store_order_items` | One atomic `UPDATE … WHERE stock_quantity >= qty`. The variant row is locked, so two simultaneous buyers cannot both succeed; the loser gets `OUT_OF_STOCK:<variant_id>` (SQLSTATE `P0001`), which aborts the item insert. Sets the variant `out_of_stock` at 0. |
| `restore_inventory_on_cancel` → `trg_restore_inventory_cancel` | trigger, after update on `store_orders` | When status becomes `cancelled`, adds the quantities back and reactivates `out_of_stock` variants |
| `expire_stale_pending_orders(minutes = 15)` | function, service role | Cancels orders still `placed` + `pending` payment after N minutes (skips rows locked by a payment being verified); the cancel trigger releases stock. Returns the count. |
| `revive_cancelled_order(order_id)` | function, service role | If a payment arrives after expiry, re-takes stock atomically (all-or-nothing). Returns `true` → order is `placed` again; `false` → an item sold out, flag a refund. Used by the webhook and verify-payment routes. |
| `pg_cron` job `expire-pending-orders` | schedule | Runs expiry every 5 minutes **if** the `pg_cron` extension is available; otherwise logs a notice and you call `/api/store/cron/expire-orders` (with `CRON_SECRET`) from any scheduler |

---

## 6. Row Level Security summary (`002`, `003`, `007`)

"Admin" = a `user_security` row with `is_store_admin = true` for `auth.uid()`.

| Table(s) | Anonymous / customer | Admin |
|---|---|---|
| BB Health tables (§2) | Own rows only (all operations) | — (no special access) |
| `user_security` | Read own row only; **no writes** | Same (admin writes go through SQL editor / service role) |
| `password_otp_requests`, `store_razorpay_events` | **No access** (RLS on, no policies) | No access; service role only |
| `store_categories`, `store_brands` | Read where `is_active` | Full |
| `store_products` | Read where `published` and availability not `inactive`/`discontinued` | Full |
| `store_product_variants` | Read where variant not `inactive`/`discontinued` **and** its product is published and not `inactive` | Full |
| `store_product_categories`, `product_groups`, `product_types`, `product_catalogue`, `product_catalogue_variants` | Read all | Full |
| `store_cart_items`, `store_wishlist_items` | Own rows (all operations) | — |
| `store_delivery_profiles` | Own rows (all operations) | Read all |
| `store_orders`, `store_order_items` | **Read own only. No insert, update or delete.** | Full |
| `store_offers` | Read where `is_active` | Full |
| `store_settings` | Read all | Full |
| `admin_audit_log` | No access | Full |

**Why customers cannot insert orders:** orders are created only by the
server (`POST /api/store/checkout/create-order`, service-role key), which
prices the cart itself and creates the Razorpay order. A client insert policy
would let any signed-in user create a "paid" order at any price straight from
the browser.

**Why admin status can't be self-granted:** it lives in `user_security`,
which has no client write policy (see §3). Admin policies check it with
`exists (select 1 from user_security where user_id = auth.uid() and is_store_admin = true)`.

---

## 7. Views (`008`)

| View | Returns |
|---|---|
| `store_low_stock_variants` | Variants of published products at or below `low_stock_threshold`, lowest stock first |
| `store_order_summary` | One row: counts per status, total orders, total and current-month revenue (cancelled excluded) |

Supabase exposes every public view over REST, so both are protected twice:
`security_invoker = true` (they run with the caller's permissions and
respect RLS) **plus** an explicit admin check in the `WHERE`. Anonymous and
non-admin callers get no stock rows, and the summary returns a single row of
zeros. The app doesn't query these yet; they are ready for an admin
dashboard.

---

## 8. Seed data (`009`, `010`)

- **`009`** — 14 top-level categories, 4 Protein subcategories (whey, casein, plant, bars), sample brand `BodyBuddy Nutrition`, and `store_settings` defaults: `store_name`, `store_tagline`, `store_announcement`, `store_announcement_active`, `maintenance_mode`, `featured_category_ids`, plus the shipping-label return address keys (`return_business_name`, `return_address_line1/2`, `return_city`, `return_state`, `return_pincode`, `return_country`, `return_phone`). All `ON CONFLICT DO NOTHING`.
- **`010`** — loads the master catalogue in one transaction as upserts: 11 groups, 20 types, 332 products, 429 variants. Products start as `draft`; nothing reaches the storefront until an admin imports it into `store_products` and publishes it.

---

## 9. Realtime

Added to the `supabase_realtime` publication so the app updates live:
`user_settings`, `foods`, `day_logs`, `daily_water`, `weight_entries`,
`recent_foods`, `recent_food_logs`, `recent_food_log_contributions`,
`meal_combos`, `meal_combo_items`, `milestones`, `store_categories`,
`store_products`, `store_product_variants`, `store_orders`.

---

## 10. Triggers at a glance

| Trigger | Table | Effect |
|---|---|---|
| `on_auth_user_created` | `auth.users` | Provision `user_settings` + `user_security` |
| `*_updated_at` (12 triggers) | categories, products, variants, groups, types, catalogue, catalogue variants, `user_security`, offers, cart, orders, addresses | Stamp `updated_at` |
| `trg_reverse_dish_contribution` | `recent_food_log_contributions` | Undo a dish's credit on delete |
| `trg_deduct_inventory` | `store_order_items` | Atomic stock deduction |
| `trg_restore_inventory_cancel` | `store_orders` | Restore stock on cancel |
| `store_delivery_profiles_single_default` | `store_delivery_profiles` | One default address per user |

---

## 11. Maintenance notes

- **Promote / revoke an admin:** see `011_promote_store_admin.sql` (includes a revoke statement).
- **Changing the schema later:** add a new file `012_…sql` for the change instead of editing applied files on a live database, and update this README in the same commit.
- **Backups:** Supabase → Database → Backups before any manual change.
