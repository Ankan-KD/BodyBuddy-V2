-- ════════════════════════════════════════════════════════════════════════
-- 001 — Extensions & shared functions
-- Depends on: nothing. Run this first.
--
-- Contains
--   • pgcrypto            — gen_random_uuid() and hashing helpers
--   • set_updated_at()    — generic BEFORE UPDATE trigger function that
--                           stamps updated_at = now(). Attached to every
--                           store, catalogue and user_security table that
--                           carries an updated_at column.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

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
