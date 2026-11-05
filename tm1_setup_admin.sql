-- TM1 MDS Dashboard — give the first admin account its role (project TCIM).
-- Run in Supabase → SQL editor AFTER:
--   1. tm1_mds_supabase_schema.sql has been run once, and
--   2. the user has been created in Authentication → Users → Add user (Auto Confirm ticked).
-- Replace admin@example.org with the admin's email (twice). No password here: it is set only in the Supabase dashboard.

insert into public.app_profiles (user_id, email, role)
select id, email, 'admin' from auth.users where email = 'admin@example.org'
on conflict (user_id) do update set role = 'admin', country_iso3 = null;

-- Check: must return one row with role = admin
select u.email, p.role, u.email_confirmed_at is not null as confirmed
  from auth.users u join public.app_profiles p on p.user_id = u.id
 where u.email = 'admin@example.org';
