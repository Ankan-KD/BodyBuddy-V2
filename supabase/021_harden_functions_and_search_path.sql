-- BodyBuddy — Harden functions flagged by the Supabase Security Advisor
-- Run this in your Supabase SQL editor AFTER 020_fix_security_definer_views.sql.
--
-- Addresses two categories from your Advisor report:
--
-- 1. "Function Search Path Mutable"
--    A function without an explicit `search_path` inherits whatever
--    search_path the CALLING session has set. A malicious caller can set
--    their own search_path to a schema containing look-alike objects
--    (e.g. a fake "public.store_products") before calling the function,
--    tricking it into operating on the attacker's objects instead of the
--    real ones — especially dangerous for SECURITY DEFINER functions,
--    which then do this with elevated privileges. Every function below
--    is pinned to `search_path = public` (or `public, auth` for the two
--    that read auth.users), matching Postgres's own recommended fix.
--    ALTER FUNCTION is used instead of CREATE OR REPLACE so this migration
--    cannot accidentally change any function's actual logic — only its
--    search_path configuration.
--
-- 2. "Public / Signed-in Users Can Execute SECURITY DEFINER Function"
--    Supabase's PostgREST layer auto-exposes every function in the public
--    schema as a callable RPC endpoint, granted to `anon`/`authenticated`
--    by default. Three of the flagged functions are SECURITY DEFINER and
--    were never meant to be called directly by any user at all — they
--    exist purely as trigger bodies (handle_new_user,
--    prevent_self_privilege_escalation) or as an internal helper never
--    actually referenced anywhere in this codebase's policies or app code
--    (is_store_admin — every RLS policy here inlines its own
--    `exists (select 1 from user_settings where ...)` check instead of
--    calling it). Revoking EXECUTE from anon/authenticated does not break
--    anything: trigger functions run automatically as part of the
--    triggering statement and do not require the triggering role to hold
--    a separate EXECUTE grant on the trigger function itself.
--
--    generate_order_number() is also locked down the same way — grep
--    confirms it is only ever called server-side via the service-role
--    client (src/app/api/store/checkout/create-order/route.ts), never
--    from the browser, so anon/authenticated never legitimately need it.

-- ── 1. Pin search_path on every flagged (and related) function ──────────

alter function public.handle_new_user()                                    set search_path = public;
alter function public.set_updated_at()                                     set search_path = public;
alter function public.generate_order_number()                              set search_path = public;
alter function public.deduct_inventory_on_order()                          set search_path = public;
alter function public.restore_inventory_on_cancel()                        set search_path = public;
alter function public.rename_product_group(uuid, text, text)               set search_path = public;
alter function public.rename_product_type(uuid, text, text)                set search_path = public;
alter function public.enforce_single_default_address()                     set search_path = public;
alter function public.is_store_admin()                                     set search_path = public;
alter function public.prevent_self_privilege_escalation()                  set search_path = public;
alter function public.user_has_password(uuid)                              set search_path = public, auth;
alter function public.get_auth_user_id_by_email(text)                      set search_path = public, auth;
alter function public.mark_password_set(uuid)                             set search_path = public;

-- ── 2. Lock down SECURITY DEFINER functions that should never be called
--       directly via the public API ──────────────────────────────────────

revoke execute on function public.handle_new_user()                     from public, anon, authenticated;
revoke execute on function public.is_store_admin()                      from public, anon, authenticated;
revoke execute on function public.prevent_self_privilege_escalation()   from public, anon, authenticated;
revoke execute on function public.generate_order_number()               from public, anon, authenticated;
grant  execute on function public.generate_order_number()               to service_role;

-- ── 3. Not covered here — needs your attention directly ─────────────────
--
-- Your Advisor report also flagged `public.decrement_inventory_on_order`
-- and `public.rls_auto_enable`. Neither exists anywhere in this project's
-- migration files (grep across supabase/*.sql confirms it) — they must
-- have been created directly against your live database at some point
-- (manually, via the SQL editor, or by an earlier session I don't have a
-- record of), so I can't safely rewrite them without seeing their actual
-- definition — guessing at their body risks breaking whatever they do.
--
-- To fix them yourself: run this in the SQL editor to see each one's
-- current definition, decide whether it's still needed, then apply the
-- same two fixes (search_path + revoke execute if it's meant to be
-- internal-only):
--
--   select proname, prosecdef, pg_get_functiondef(oid)
--   from pg_proc
--   where proname in ('decrement_inventory_on_order', 'rls_auto_enable')
--     and pronamespace = 'public'::regnamespace;
--
-- If `decrement_inventory_on_order` turns out to be a leftover duplicate
-- of this project's `deduct_inventory_on_order` (same job, older name),
-- confirm nothing still triggers it, then drop it instead of patching it:
--   drop function if exists public.decrement_inventory_on_order() cascade;

-- ── 4. Not SQL-fixable — do this in the Supabase Dashboard ───────────────
-- "Leaked Password Protection Disabled": Dashboard → Authentication →
-- Policies (or Auth → Providers → Password) → enable "Leaked password
-- protection" (checks new passwords against HaveIBeenPwned). No migration
-- can toggle this — it's an Auth service setting, not a database object.
