-- ════════════════════════════════════════════════════════════════════════
-- 011 — Promote a user to BB Store admin
-- Depends on: 003 (user_security)
--
-- Run AFTER the account has signed up normally in the app. Replace the
-- email below, then run it in the Supabase SQL editor (postgres session).
--
-- Signed-in app users cannot do this themselves: public.user_security has
-- no insert/update/delete policy, so only the SQL editor, the service role
-- and SECURITY DEFINER functions can change admin status.
-- ════════════════════════════════════════════════════════════════════════

insert into public.user_security (user_id, is_store_admin)
select id, true from auth.users where email = 'mailid@gmail.com'
on conflict (user_id) do update set is_store_admin = true;

-- Verify (should return is_store_admin = true):
--   select u.email, s.is_store_admin
--   from public.user_security s join auth.users u on u.id = s.user_id
--   where u.email = 'mailid@gmail.com';
--
-- To revoke admin:
--   update public.user_security set is_store_admin = false
--   where user_id = (select id from auth.users where email = 'mailid@gmail.com');
