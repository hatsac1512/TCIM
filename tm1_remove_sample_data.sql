-- TM1 MDS Dashboard — remove the presentation SAMPLE DATA and demo accounts (project TCIM).
-- Run in Supabase → SQL editor BEFORE real data collection starts.
-- WARNING: deletes ALL submissions (and their parts) and the whole audit log — run it only while
-- the database still holds sample data. Real accounts (e.g. the admin) are kept.
-- Then set SAMPLE_DATA: false in src/shell.html (TM1_CONFIG) and rebuild.
begin;
delete from public.audit_log;
delete from public.submissions;                               -- readiness, availability, indicators follow (on delete cascade)
delete from auth.users where email like '%@demo.local';       -- demo accounts; their profiles and MFA factors follow
commit;

select (select count(*) from public.submissions) as submissions, (select count(*) from auth.users) as users_left;
