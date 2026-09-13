-- BodyBuddy — Close self-privilege-escalation hole on public.user_settings
-- Run this in your Supabase SQL editor AFTER 017_fix_signup_pending_race.sql.
--
-- THE BUG:
-- The "own settings" RLS policy on public.user_settings (001_core_schema.sql)
-- is `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
-- That check only verifies WHICH ROW is being touched — it says nothing
-- about WHICH COLUMNS. Every admin-gated table's RLS policy (store
-- products, orders, offers, etc.) trusts `is_store_admin = true` on this
-- table. Because the row-level check passes for a user updating their own
-- row, any signed-in user could open devtools and run:
--
--   supabase.from('user_settings').update({ is_store_admin: true }).eq('user_id', myId)
--
-- ...and grant themselves full store-admin access — no server involved.
-- The same gap applies to pending_email_verify and password_set, which
-- gate the signup/OTP/set-password flow (015/016/017): a user could set
-- password_set = true to skip choosing a real password, or flip
-- pending_email_verify to bypass OTP.
--
-- THE FIX: a BEFORE UPDATE trigger that blocks changes to these three
-- security-relevant columns unless the write comes from:
--   (a) the service-role key (every legitimate server-side write to these
--       columns already goes through supabaseAdmin — see
--       src/lib/supabaseAdmin.ts, /api/signup/*, /api/password/mark-set),
--   (b) the Supabase SQL editor / a superuser session (how the first admin
--       account is granted per the instructions in 003_store_admin.sql), or
--   (c) an acting user who is already a store admin themself (so a real
--       admin panel could promote/demote other admins in future without
--       needing a schema change).
-- Everything else about user_settings (goals, name, units, theme, etc.)
-- is untouched — users can still freely edit their own preferences.

create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_is_admin boolean;
begin
  -- (a) Server-side writes (service role) and (b) the SQL editor /
  -- superuser sessions are always trusted.
  if auth.role() = 'service_role' or current_user in ('postgres', 'service_role') then
    return new;
  end if;

  -- From here on this is an ordinary end-user request arriving through
  -- the anon/authenticated Postgres role (i.e. the browser's Supabase
  -- client, straight from devtools or the app). Only an existing admin
  -- may change these flags — never the user acting on their own row.
  select coalesce(is_store_admin, false)
    into acting_is_admin
    from public.user_settings
   where user_id = auth.uid();

  if not coalesce(acting_is_admin, false) then
    if new.is_store_admin is distinct from old.is_store_admin then
      raise exception 'Not authorized to change is_store_admin';
    end if;
    if new.pending_email_verify is distinct from old.pending_email_verify then
      raise exception 'Not authorized to change pending_email_verify';
    end if;
    if new.password_set is distinct from old.password_set then
      raise exception 'Not authorized to change password_set';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_privilege_escalation on public.user_settings;
create trigger trg_prevent_self_privilege_escalation
  before update on public.user_settings
  for each row
  execute function public.prevent_self_privilege_escalation();

-- Sanity check after applying: as a normal signed-in (non-admin) user,
-- this should now raise "Not authorized to change is_store_admin":
--   update public.user_settings set is_store_admin = true where user_id = auth.uid();
-- ...while updating e.g. `name` or `calorie_goal` on your own row should
-- still work exactly as before.
