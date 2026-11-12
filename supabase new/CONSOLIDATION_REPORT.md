# SQL Consolidation Report

This report documents the consolidation of `supabase/` from 21 incremental
migration files into a clean, production-oriented structure. It was
produced by (1) reading every file in full, (2) building a dependency map
of every table/column/function/trigger/policy/view, (3) writing the
consolidated files, and (4) **actually executing all 11 new files in
order against a real PostgreSQL 16 instance** (with a mocked Supabase
`auth` schema, `anon`/`authenticated`/`service_role` roles, and the
`supabase_realtime` publication) to confirm they run cleanly end-to-end
with zero errors before anything old was removed.

`README_do_not_run.sql` was left untouched and out of scope — it's a plain
ERD-style reference document (references a generic `users` table, no RLS,
no `auth.users`), not an executable migration, and its own filename says
not to run it.

---

## A. Old structure (21 files, in execution order)

| # | File | Purpose |
|---|------|---------|
| 001 | `001_core_schema.sql` | BB Health core: user_settings, foods, day_logs, daily_water, weight_entries, recent_foods, recent_food_logs, meal_combos, milestones; `handle_new_user()` v1 |
| 002 | `002_store_schema.sql` | Store foundation: categories, brands, products, variants, product_categories; adds `is_store_admin` to user_settings; `set_updated_at()` v1 |
| 003 | `003_store_admin.sql` | admin_audit_log table; `is_store_admin()`; redundant `user_settings_self_read` policy |
| 004 | `004_store_cart.sql` | store_cart_items; `set_updated_at()` v2 (re-declared) |
| 005 | `005_store_orders.sql` | store_orders, store_order_items, order number sequence/generator (original narrow payment_method check; original client-side insert policies) |
| 006 | `006_inventory_automation.sql` | Inventory deduct/restore triggers; store_low_stock_variants & store_order_summary views (plain, insecure); duplicate "Admins manage variants" policy |
| 007 | `007_phase9_features.sql` | store_offers, store_settings, `is_featured` on categories; `set_updated_at()` v3 (re-declared) |
| 008 | `008_product_type_and_categories.sql` | Adds `product_type`, `catalog_source_id` to store_products |
| 009 | `009_catalogue_redesign.sql` | product_groups, product_types, product_catalogue, product_catalogue_variants; adds `product_group_id`/`product_type_id` to store_products; rename functions |
| **010** | `010_seed_groups_types_from_catalogue.sql` | **Immutable bulk seed** — 332 products / 429 variants generated from the master catalogue CSV |
| 011 | `011_razorpay_and_delivery.sql` | Razorpay columns/events table on store_orders; widens payment_method check (DROP+ADD); store_delivery_profiles; return-address settings |
| 012 | `012_password_otp.sql` | Documentation only — no schema (fully superseded by 013) |
| 013 | `013_password_otp_secure.sql` | password_otp_requests table; `user_has_password()`, `get_auth_user_id_by_email()` |
| 014 | `014_wishlist_and_addresses.sql` | store_wishlist_items; `label` column + single-default trigger on delivery profiles |
| 015 | `015_fix_signup_verify_otp.sql` | Adds `pending_email_verify` to user_settings; widens OTP `purpose` check |
| 016 | `016_password_set_flag.sql` | Adds `password_set` to user_settings; one-time backfill |
| 017 | `017_fix_signup_pending_race.sql` | `handle_new_user()` v2 (final) — atomic pending-verify insert |
| 018 | `018_fix_self_admin_escalation.sql` | `prevent_self_privilege_escalation()` + trigger on user_settings |
| 019 | `019_remove_client_order_insert.sql` | **Drops** client-side order/order-item insert policies from 005 |
| 020 | `020_fix_security_definer_views.sql` | **Replaces** the two views from 006 with secure `security_invoker` + admin-gated versions |
| 021 | `021_harden_functions_and_search_path.sql` | `search_path` pinning + EXECUTE revoke/grant across nearly every function |

---

## B. New structure (11 files + the untouched seed)

| File | Contents |
|------|----------|
| `001_extensions_and_shared_functions.sql` | `pgcrypto`; single authoritative `set_updated_at()` |
| `002_core_health_schema.sql` | All 9 BB Health tables (final columns incl. `is_store_admin`/`pending_email_verify`/`password_set` on user_settings), indexes, RLS+policies, realtime, one-time emoji backfill |
| `003_auth_and_signup_security.sql` | password_otp_requests; `user_has_password()`, `get_auth_user_id_by_email()`, `user_pending_email_verify()`, `mark_password_set()`; final `handle_new_user()` + trigger; `prevent_self_privilege_escalation()` + trigger |
| `004_store_catalog_schema.sql` | store_categories, store_brands, product_groups, product_types, store_products (final columns), store_product_variants, store_product_categories, product_catalogue, product_catalogue_variants; rename functions; updated_at triggers; realtime |
| `005_store_commerce_schema.sql` | store_cart_items, store_orders (final payment_method check + Razorpay columns), store_order_items, order-number sequence/generator, inventory automation, store_razorpay_events, store_delivery_profiles (+ label, single-default trigger + backfill), store_wishlist_items, store_offers, store_settings |
| `006_store_admin_security.sql` | admin_audit_log table; `is_store_admin()`; documented promotion procedure |
| `007_store_security_rls.sql` | **Every** store RLS policy, centralized for auditability |
| `008_store_views.sql` | Final secure `store_low_stock_variants` / `store_order_summary` views |
| `009_seed_and_configuration.sql` | Starter categories/subcategories, sample brand, store_settings defaults + return address |
| `010_seed_groups_types_from_catalogue.sql` | **Byte-for-byte untouched** original file |
| `011_promote_store_admin.sql` | Your requested admin-promotion `UPDATE`, documented |

---

## C. Consolidations (old → new)

- `001` → `002` (health tables) + `003` (handle_new_user, superseded by 017's version)
- `002` → `004` (catalog tables) + `002` (is_store_admin column) + `001` (set_updated_at v1)
- `003` → `006` (admin table/function) + `002`'s policy list (redundant policy dropped, see D)
- `004` → `005` (cart table) + `001` (set_updated_at v2, discarded as duplicate)
- `005` → `005` (orders/items — narrow payment_method check and insert policies superseded by 011 / 019)
- `006` → `005` (inventory functions/triggers) + `008` (views — insecure versions superseded by 020) + `007` policy list (duplicate policy dropped)
- `007` → `005` (offers/settings tables) + `004` (is_featured column) + `001` (set_updated_at v3, discarded as duplicate)
- `008` → `004` (product_type/catalog_source_id columns)
- `009` → `004` (groups/types/catalogue tables, rename functions)
- `011` → `005` (Razorpay columns/table, delivery profiles, final payment_method check) + `009` (return-address settings)
- `012` → nothing (pure documentation, no schema; fully superseded by 013)
- `013` → `003` (OTP table + two functions)
- `014` → `005` (wishlist table, label column, single-default trigger)
- `015` → `002` (pending_email_verify column, folded into user_settings) + `003` (widened OTP purpose check, folded into table)
- `016` → `002` (password_set column + backfill, folded into user_settings)
- `017` → `003` (final `handle_new_user()` — this is the version actually used)
- `018` → `003` (escalation-prevention function + trigger)
- `019` → `007` (its effect: two policies are simply absent)
- `020` → `008` (its effect: the final secure view definitions)
- `021` → folded directly into each `CREATE FUNCTION` statement across `003`/`004`/`005`/`006` as inline `SET search_path` + adjacent `REVOKE`/`GRANT EXECUTE`, rather than kept as separate trailing `ALTER FUNCTION` patches

## D. Removed redundancies

1. **`set_updated_at()` — defined 3×** (in 002, 004, 007), byte-identical logic each time. Consolidated to one definition in `001`.
2. **`user_settings_self_read` policy** (003) — a `SELECT`-only policy with the exact same `auth.uid() = user_id` condition as the pre-existing `"own settings"` `ALL` policy from 001. Zero effect on access; not recreated.
3. **`"Admins manage variants"` policy** (006) — functionally identical duplicate of `"store_variants_admin_all"` already created in 002. Only one kept.
4. **`012_password_otp.sql`** — pure documentation/comments, no executable schema at all; fully superseded by 013. Not carried forward as a file.
5. **`store_orders.payment_method` check constraint** — originally narrow (005), then DROP+ADD widened (011). Only the final widened constraint is written, directly in the `CREATE TABLE`.
6. **Two insecure views** (`store_low_stock_variants`, `store_order_summary` from 006) — fully replaced by 020's `security_invoker` + admin-gated versions. The insecure originals are not reproduced anywhere.

## E. Security preservation — confirmed

- ✅ RLS is enabled on **every** table that had it enabled before (health tables, store tables, `password_otp_requests`, `store_razorpay_events`).
- ✅ The **self-privilege-escalation trigger** (`prevent_self_privilege_escalation`) is preserved verbatim on `user_settings`, blocking any non-admin/non-service-role write to `is_store_admin`, `pending_email_verify`, or `password_set`.
- ✅ **Checkout/order security regression is preserved, not reverted**: no client-side `INSERT` policy exists on `store_orders`/`store_order_items` — orders can only be created server-side via the service-role key, exactly as after `019` ran. This was the single most safety-critical judgment call in the whole consolidation; see the note at the top of `007_store_security_rls.sql`.
- ✅ **View security is preserved at its final (fixed) state**: both admin views use `security_invoker = true` plus an explicit `is_store_admin` check, not the original insecure versions.
- ✅ **Function hardening preserved**: every `SECURITY DEFINER` function pins `search_path`; `EXECUTE` is revoked from `public`/`anon`/`authenticated` and re-granted only to `service_role` for every server-only function (`generate_order_number`, `is_store_admin`, `user_has_password`, `get_auth_user_id_by_email`, `user_pending_email_verify`, `mark_password_set`, `handle_new_user`, `prevent_self_privilege_escalation`).
- ✅ **Admin gating unchanged**: every store admin-write policy still checks `user_settings.is_store_admin = true` via the same `EXISTS` subquery pattern used throughout.
- ✅ **Storage**: no Supabase Storage buckets or `storage.*` policies exist anywhere in the original 21 files (confirmed via grep across the whole folder), so no storage file was needed or created.

## F. SQL #10 — confirmed untouched

`010_seed_groups_types_from_catalogue.sql` was copied into the new
structure with **zero modification**. Verified by direct byte comparison:

```
md5sum (original) = cd0fc1c8c4f6370a194be19976c08634
md5sum (new copy)  = cd0fc1c8c4f6370a194be19976c08634   ← identical
```

Its filename, position (`010`), and every byte of its contents are
exactly as they were.

## G. Validation performed

1. **Static review** — every `CREATE`, `ALTER`, `DROP`, `GRANT`/`REVOKE`
   statement across all 21 original files was read and mapped to its
   final destination object-by-object.
2. **Live execution test** — installed PostgreSQL 16 locally, created a
   mock Supabase environment (`auth.users`, `auth.uid()`, `auth.role()`,
   the `anon`/`authenticated`/`service_role` roles, and the
   `supabase_realtime` publication), then ran all 11 new files **in
   numeric order against a fresh database**. Result: **all 11 files
   executed successfully with zero errors**, including the seed data
   inserts and your requested admin-promotion query.
3. **Dependency-order bug found and fixed during that test run**:
   `store_products` (originally destined for the top of the catalog file)
   references `product_groups`/`product_types` via foreign key, but those
   two tables weren't created until later in the same file — the first
   run failed with `relation "public.product_groups" does not exist`.
   Fixed by moving the Product Groups & Types section earlier in
   `004_store_catalog_schema.sql`, then re-validated end-to-end
   successfully.
4. **Idempotency check** — `009_seed_and_configuration.sql`'s `ON
   CONFLICT DO NOTHING` inserts and `004`/`005`'s `DROP TRIGGER IF EXISTS`
   / `CREATE OR REPLACE` / `DROP POLICY IF EXISTS` patterns were verified
   to allow every file to be re-run safely without erroring.

**No unresolved conflicts.** The only place where two historical files
disagreed on behavior (`payment_method` check constraint width; the two
`store_orders` insert policies; the two dashboard views) each had an
unambiguous, dated "supersedes" relationship (a later file explicitly
`DROP`s or `DROP CONSTRAINT ... ADD CONSTRAINT`s the earlier definition),
so the final state was safely determinable in every case and is called
out explicitly in the CONSOLIDATION NOTE at the top of the relevant new
file.

---

## Applying this to an existing (already-deployed) database

These files are written to run cleanly on a **fresh** project. If you're
pointing them at a database that already ran the old 21-file history, the
`create table if not exists` / `create or replace function` / `drop
policy if exists` + `create policy` patterns used throughout make every
file safe to re-run — nothing will error out or duplicate, and the end
state converges to exactly what's described above.
