-- ═══════════════════════════════════════════════════════════════════════════
-- TM1 MDS Dashboard — Supabase database (PostgreSQL 15+)
-- Backend for index.html in LIVE mode. Follows the System Summary:
--   §5 tables/views · §6 who can do what · §7 protection (MFA, RLS, audit log).
--
-- HOW TO USE (new Supabase project — do NOT reuse the K-PaF project):
--   1. Supabase → SQL editor → paste this whole file → Run (once).
--   2. Authentication → Sign In / Providers → Email: disable "Allow new users to
--      sign up" (accounts are created by the admin only).
--   3. Authentication → Multi-Factor → enable TOTP (authenticator app).
--   4. Create each user: Authentication → Users → Add user (email + password),
--      then give the role (and country for focal points), e.g.:
--        insert into public.app_profiles (user_id, email, role, country_iso3)
--        select id, email, 'country_focal_point', 'VNM' from auth.users where email = 'name@example.org';
--      Roles: admin | who_reviewer | country_focal_point | viewer (default).
--   5. In index.html paste the project URL and the publishable (anon) key.
--
-- Design: the website can only READ (views, through row-level security). Every
-- WRITE goes through two functions — save_submission() and set_submission_status()
-- — which check role, country, status and completeness, and write the audit log.
-- Nothing works without MFA: sessions that have not passed the 6-digit code
-- (aal2) see no data and cannot write.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

create schema if not exists private;   -- helper functions; not exposed by the API

-- ─────────────────────────── 1. Reference tables ───────────────────────────
create table public.countries (
  iso3 text primary key check (iso3 ~ '^[A-Z]{3}$'),
  name text not null
);
-- WHO Western Pacific Member States (areas not included — list to be confirmed)
insert into public.countries (iso3, name) values
 ('AUS','Australia'),('BRN','Brunei Darussalam'),('KHM','Cambodia'),('CHN','China'),('COK','Cook Islands'),
 ('FJI','Fiji'),('JPN','Japan'),('KIR','Kiribati'),('LAO','Lao People''s Democratic Republic'),('MYS','Malaysia'),
 ('MHL','Marshall Islands'),('FSM','Micronesia (Federated States of)'),('MNG','Mongolia'),('NRU','Nauru'),
 ('NZL','New Zealand'),('NIU','Niue'),('PLW','Palau'),('PNG','Papua New Guinea'),('PHL','Philippines'),
 ('KOR','Republic of Korea'),('WSM','Samoa'),('SGP','Singapore'),('SLB','Solomon Islands'),('TON','Tonga'),
 ('TUV','Tuvalu'),('VUT','Vanuatu'),('VNM','Viet Nam');

-- One place for the agreed definitions (update "definition" after the regional consultation)
create table public.mds_dictionary (
  code text primary key,
  kind text not null check (kind in ('criterion','mds_item','indicator')),
  tier text check (tier in ('core','expanded','metadata')),
  label text not null,
  definition text,
  sort_order int not null
);
insert into public.mds_dictionary (code, kind, tier, label, sort_order) values
 ('c1','criterion',null,'Traditional medicine providers are licensed or registered',1),
 ('c2','criterion',null,'Traditional medicine services are delivered in public facilities',2),
 ('c3','criterion',null,'Public health insurance covers traditional medicine services',3),
 ('c4','criterion',null,'The national disease classification contains traditional medicine codes',4),
 ('c5','criterion',null,'Traditional medicine encounters are captured in routine health information systems or claims',5),
 ('reporting_year','mds_item','core','Reporting year',11),('facility_type','mds_item','core','Facility type',12),
 ('provider_type','mds_item','core','Provider type',13),('encounter_type','mds_item','core','Encounter type',14),
 ('age_group','mds_item','core','Age group',15),('sex','mds_item','core','Sex',16),
 ('tm1_disorder','mds_item','core','TM1 disorder code',17),('tm1_pattern','mds_item','core','TM1 pattern code',18),
 ('icd11_dx','mds_item','expanded','Conventional ICD-11 diagnosis',19),('intervention','mds_item','expanded','Type of intervention',20),
 ('payment','mds_item','expanded','Source of payment',21),('coding_method','mds_item','metadata','Coding method (direct TM1 or mapped)',22),
 ('i1','indicator',null,'Encounters per 1000 population',31),
 ('i2','indicator',null,'Distribution by facility and provider type',32),
 ('i3','indicator',null,'Age and sex distribution',33),
 ('i4','indicator',null,'Ten most frequent TM1 disorders and patterns',34),
 ('i5','indicator',null,'Proportion of encounters with a pattern code',35),
 ('i6','indicator',null,'Dual-coding rate',36);

-- ─────────────────────────── 2. Users and roles ───────────────────────────
create table public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin','who_reviewer','country_focal_point','viewer')),
  country_iso3 text references public.countries(iso3),
  constraint focal_point_needs_country check (role <> 'country_focal_point' or country_iso3 is not null)
);

-- ─────────────────────────── 3. Submissions and the three parts ───────────────────────────
create table public.submissions (
  id bigint generated always as identity primary key,
  country_iso3 text not null references public.countries(iso3),
  reporting_year int not null check (reporting_year between 2020 and 2100),
  code text generated always as ('TM1-' || country_iso3 || '-' || reporting_year::text) stored,
  status text not null default 'draft' check (status in ('prefilled','draft','submitted','returned','validated')),
  proposed_type text check (proposed_type in ('A','B','C')),
  confirmed_type text check (confirmed_type in ('A','B','C')),
  who_comment text check (char_length(who_comment) <= 2000),
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  updated_by_email text,
  submitted_at timestamptz,
  submitted_by_email text,
  validated_at timestamptz,
  validated_by_email text,
  unique (country_iso3, reporting_year)
);

create table public.readiness (                       -- Part 1
  submission_id bigint not null references public.submissions(id) on delete cascade,
  criterion text not null check (criterion in ('c1','c2','c3','c4','c5')),
  answer text check (answer in ('no','partial','full')),
  evidence text check (char_length(evidence) <= 400),
  primary key (submission_id, criterion)
);

create table public.mds_availability (                -- Part 2
  submission_id bigint not null references public.submissions(id) on delete cascade,
  item_code text not null references public.mds_dictionary(code),
  status text not null check (status in ('available','partly','not_available')),
  source text check (source in ('claims','his','sentinel','hh_survey','fac_survey','registry','other')),
  source_other text check (char_length(source_other) <= 160),   -- text typed when source = 'other'
  primary key (submission_id, item_code)
);

create table public.indicators (                      -- Part 3
  submission_id bigint not null references public.submissions(id) on delete cascade,
  indicator_code text not null references public.mds_dictionary(code),
  reported boolean not null,
  value_num numeric check (value_num >= 0),
  value_json jsonb check (value_json is null or jsonb_typeof(value_json) = 'object'),
  source text check (source in ('claims','his','sentinel','hh_survey','fac_survey','registry','other')),
  source_other text check (char_length(source_other) <= 160),          -- text typed when the choice is 'other'
  coverage text check (coverage in ('national','subnational','sentinel','other')),
  coverage_note text check (char_length(coverage_note) <= 160),
  coding_method text check (coding_method in ('direct','mapped','mixed','other')),
  coding_method_other text check (char_length(coding_method_other) <= 160),
  primary key (submission_id, indicator_code)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  email text,
  submission_id bigint references public.submissions(id) on delete set null,
  submission_code text,
  country_iso3 text,
  action text not null,
  detail text,
  old_value jsonb,
  new_value jsonb
);
create index audit_log_submission_idx on public.audit_log (submission_id, at desc);

-- ─────────────────────────── 4. Helper functions ───────────────────────────
create or replace function private.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.role from public.app_profiles p where p.user_id = auth.uid()), 'viewer')
$$;
create or replace function private.my_country() returns text
language sql stable security definer set search_path = '' as $$
  select p.country_iso3 from public.app_profiles p where p.user_id = auth.uid()
$$;
-- MFA: the session must have passed the 6-digit code (Authenticator Assurance Level 2)
create or replace function private.mfa_ok() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
create or replace function private.is_who() returns boolean
language sql stable set search_path = '' as $$
  select private.my_role() in ('admin','who_reviewer')
$$;
-- Visibility rule (System Summary §6): validated → everyone; WHO → all; focal point → own country
create or replace function private.can_see(p_country text, p_status text) returns boolean
language sql stable set search_path = '' as $$
  select private.mfa_ok() and (
    p_status = 'validated' or private.is_who()
    or (private.my_role() = 'country_focal_point' and p_country = private.my_country()))
$$;
-- Readiness type — DRAFT rule (System Summary §4): A all Fully; C c5 No and c1 not Fully; B other
create or replace function private.readiness_type(p_sub bigint) returns text
language sql stable set search_path = '' as $$
  select case
    when count(answer) < 5 then null
    when bool_and(answer = 'full') then 'A'
    when max(answer) filter (where criterion = 'c5') = 'no'
     and max(answer) filter (where criterion = 'c1') <> 'full' then 'C'
    else 'B' end
  from public.readiness where submission_id = p_sub and answer is not null
$$;
-- What is still missing before submission (the website shows the same list)
create or replace function private.missing_fields(p_sub bigint) returns text[]
language sql stable set search_path = '' as $$
  select array(
    select 'Part 1 · criterion ' || substr(d.code, 2) from public.mds_dictionary d
     where d.kind = 'criterion' and not exists (select 1 from public.readiness r where r.submission_id = p_sub and r.criterion = d.code and r.answer is not null)
    union all
    select 'Part 2 · ' || d.label from public.mds_dictionary d
     where d.kind = 'mds_item' and not exists (select 1 from public.mds_availability a where a.submission_id = p_sub and a.item_code = d.code)
    union all
    select 'Part 2 · ' || d.label || ': data source' from public.mds_dictionary d
      join public.mds_availability a on a.item_code = d.code and a.submission_id = p_sub
     where a.status <> 'not_available' and a.source is null
    union all
    select 'Part 3 · ' || d.label || ': Reported / Not reported' from public.mds_dictionary d
     where d.kind = 'indicator' and not exists (select 1 from public.indicators i where i.submission_id = p_sub and i.indicator_code = d.code)
    union all
    select 'Part 3 · ' || d.label || ': value, source, coverage and coding method' from public.mds_dictionary d
      join public.indicators i on i.indicator_code = d.code and i.submission_id = p_sub
     where i.reported and (i.source is null or i.coverage is null or i.coding_method is null
       or (i.value_num is null and not coalesce(jsonb_path_exists(i.value_json, '$.** ? (@.type() == "number" || (@.type() == "string" && @ != ""))'), false)))
  )
$$;

-- ─────────────────────────── 5. Row-level security (read access) ───────────────────────────
alter table public.countries        enable row level security;
alter table public.mds_dictionary   enable row level security;
alter table public.app_profiles     enable row level security;
alter table public.submissions      enable row level security;
alter table public.readiness        enable row level security;
alter table public.mds_availability enable row level security;
alter table public.indicators       enable row level security;
alter table public.audit_log        enable row level security;

create policy countries_read on public.countries for select to authenticated using (private.mfa_ok());
create policy dictionary_read on public.mds_dictionary for select to authenticated using (private.mfa_ok());
create policy profiles_read on public.app_profiles for select to authenticated
  using (user_id = auth.uid() or (private.mfa_ok() and private.my_role() = 'admin'));
create policy submissions_read on public.submissions for select to authenticated
  using (private.can_see(country_iso3, status));
-- child rows are visible exactly when their submission is visible
create policy readiness_read on public.readiness for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));
create policy availability_read on public.mds_availability for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));
create policy indicators_read on public.indicators for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));
create policy audit_read on public.audit_log for select to authenticated
  using (private.mfa_ok() and (private.is_who()
         or (private.my_role() = 'country_focal_point' and country_iso3 = private.my_country())));
-- No insert / update / delete policies: direct writes from the website are refused.

-- ─────────────────────────── 6. Views used by the website ───────────────────────────
-- security_invoker = true → the reader's own row-level security applies to the view.
-- v_country_workspace: every submission the reader may see (WHO: all; focal point: own
-- country, any status — drafts, returned, submitted, validated; viewer: validated only).
create view public.v_country_workspace with (security_invoker = true) as
select s.id, s.code, s.country_iso3, c.name as country_name, s.reporting_year, s.status,
       s.proposed_type, s.confirmed_type, s.who_comment,
       s.created_at, s.updated_at, s.updated_by_email, s.submitted_at, s.submitted_by_email,
       s.validated_at, s.validated_by_email,
       coalesce((select jsonb_object_agg(r.criterion, jsonb_build_object('v', r.answer, 'note', coalesce(r.evidence, '')))
                   from public.readiness r where r.submission_id = s.id), '{}'::jsonb) as readiness,
       coalesce((select jsonb_object_agg(a.item_code, jsonb_strip_nulls(jsonb_build_object('v', a.status, 'src', coalesce(a.source, ''), 'srcOther', a.source_other)))
                   from public.mds_availability a where a.submission_id = s.id), '{}'::jsonb) as availability,
       coalesce((select jsonb_object_agg(i.indicator_code,
                   case when i.reported then jsonb_strip_nulls(jsonb_build_object('reported', true, 'value', i.value_num,
                          'data', i.value_json, 'src', i.source, 'cov', i.coverage, 'covNote', i.coverage_note, 'method', i.coding_method,
                          'srcOther', i.source_other, 'methodOther', i.coding_method_other))
                        else jsonb_build_object('reported', false) end)
                   from public.indicators i where i.submission_id = s.id), '{}'::jsonb) as indicators
  from public.submissions s
  join public.countries c on c.iso3 = s.country_iso3;

-- v_regional: validated submissions only — the Regional Dashboard for all users
create view public.v_regional with (security_invoker = true) as
select * from public.v_country_workspace where status = 'validated';

-- ─────────────────────────── 7. Write functions (RPC) ───────────────────────────
create or replace function public.save_submission(p_country text, p_year int, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.my_role();
  v_email text := auth.jwt() ->> 'email';
  v_sub public.submissions;
  v_new_status text;
  v_old jsonb;
  v_new jsonb;
  v_changed text;
begin
  if not private.mfa_ok() then raise exception 'Two-step verification (MFA) is required' using errcode = '42501'; end if;
  if not exists (select 1 from public.countries where iso3 = p_country) then raise exception 'Unknown Member State: %', p_country; end if;
  select * into v_sub from public.submissions where country_iso3 = p_country and reporting_year = p_year for update;

  -- Who may edit what (System Summary §6)
  if v_role = 'admin' then
    if v_sub.status = 'validated' then raise exception 'Validated submissions are locked — unlock first' using errcode = '42501'; end if;
    v_new_status := coalesce(v_sub.status, 'draft');
  elsif v_role = 'who_reviewer' then
    if v_sub.id is not null and v_sub.status <> 'prefilled' then raise exception 'WHO reviewers can edit WHO pre-fills only' using errcode = '42501'; end if;
    v_new_status := 'prefilled';
  elsif v_role = 'country_focal_point' then
    if p_country is distinct from private.my_country() then raise exception 'Focal points can edit their own country only' using errcode = '42501'; end if;
    if v_sub.id is not null and v_sub.status not in ('prefilled','draft','returned') then
      raise exception 'This submission is locked (status: %)', v_sub.status using errcode = '42501'; end if;
    v_new_status := 'draft';
  else
    raise exception 'Your role cannot submit data' using errcode = '42501';
  end if;

  if v_sub.id is null then
    insert into public.submissions (country_iso3, reporting_year, status, created_by, updated_by, updated_by_email)
    values (p_country, p_year, v_new_status, auth.uid(), auth.uid(), v_email) returning * into v_sub;
  else
    select jsonb_build_object('readiness', w.readiness, 'availability', w.availability, 'indicators', w.indicators)
      into v_old from public.v_country_workspace w where w.id = v_sub.id;
    update public.submissions set status = v_new_status, updated_at = now(), updated_by = auth.uid(), updated_by_email = v_email
     where id = v_sub.id;
  end if;

  -- Replace the three parts with what the form sent
  delete from public.readiness where submission_id = v_sub.id;
  delete from public.mds_availability where submission_id = v_sub.id;
  delete from public.indicators where submission_id = v_sub.id;

  insert into public.readiness (submission_id, criterion, answer, evidence)
  select v_sub.id, e.key, nullif(e.value ->> 'v', ''), nullif(btrim(e.value ->> 'note'), '')
    from jsonb_each(coalesce(p_data -> 'readiness', '{}'::jsonb)) e
   where e.key in ('c1','c2','c3','c4','c5')
     and (nullif(e.value ->> 'v', '') is not null or nullif(btrim(e.value ->> 'note'), '') is not null);

  insert into public.mds_availability (submission_id, item_code, status, source, source_other)
  select v_sub.id, e.key, e.value ->> 'v',
         case when e.value ->> 'v' = 'not_available' then null else nullif(e.value ->> 'src', '') end,
         case when e.value ->> 'v' <> 'not_available' and e.value ->> 'src' = 'other' then nullif(btrim(e.value ->> 'srcOther'), '') end
    from jsonb_each(coalesce(p_data -> 'availability', '{}'::jsonb)) e
   where nullif(e.value ->> 'v', '') is not null
     and exists (select 1 from public.mds_dictionary d where d.code = e.key and d.kind = 'mds_item');

  insert into public.indicators (submission_id, indicator_code, reported, value_num, value_json, source, coverage, coverage_note, coding_method,
                                 source_other, coding_method_other)
  select v_sub.id, e.key, (e.value ->> 'reported')::boolean,
         case when (e.value ->> 'reported')::boolean then nullif(e.value ->> 'value', '')::numeric end,
         case when (e.value ->> 'reported')::boolean and jsonb_typeof(e.value -> 'data') = 'object' then e.value -> 'data' end,
         case when (e.value ->> 'reported')::boolean then nullif(e.value ->> 'src', '') end,
         case when (e.value ->> 'reported')::boolean then nullif(e.value ->> 'cov', '') end,
         case when (e.value ->> 'reported')::boolean then nullif(btrim(e.value ->> 'covNote'), '') end,
         case when (e.value ->> 'reported')::boolean then nullif(e.value ->> 'method', '') end,
         case when (e.value ->> 'reported')::boolean and e.value ->> 'src' = 'other' then nullif(btrim(e.value ->> 'srcOther'), '') end,
         case when (e.value ->> 'reported')::boolean and e.value ->> 'method' = 'other' then nullif(btrim(e.value ->> 'methodOther'), '') end
    from jsonb_each(coalesce(p_data -> 'indicators', '{}'::jsonb)) e
   where jsonb_typeof(e.value -> 'reported') = 'boolean'
     and exists (select 1 from public.mds_dictionary d where d.code = e.key and d.kind = 'indicator');

  update public.submissions set proposed_type = private.readiness_type(v_sub.id) where id = v_sub.id;

  -- Audit log: which items changed (old and new values kept)
  select jsonb_build_object('readiness', w.readiness, 'availability', w.availability, 'indicators', w.indicators)
    into v_new from public.v_country_workspace w where w.id = v_sub.id;
  select string_agg(part || ' ' || k, ', ') into v_changed from (
    select p.part, k from (values ('Part 1','readiness'),('Part 2','availability'),('Part 3','indicators')) p(part, j),
      lateral jsonb_object_keys(coalesce(v_old -> p.j, '{}'::jsonb) || coalesce(v_new -> p.j, '{}'::jsonb)) k
     where (v_old -> p.j -> k) is distinct from (v_new -> p.j -> k)) x;
  insert into public.audit_log (user_id, email, submission_id, submission_code, country_iso3, action, detail, old_value, new_value)
  values (auth.uid(), v_email, v_sub.id, 'TM1-' || p_country || '-' || p_year, p_country,
          case when v_old is null then 'create' else 'save' end,
          case when v_sub.status is distinct from v_new_status then v_sub.status || ' → ' || v_new_status || '. ' else '' end
            || coalesce('Changed: ' || v_changed, 'No field changes'),
          v_old, v_new);

  return (select to_jsonb(w) from public.v_country_workspace w where w.id = v_sub.id);
end $$;

create or replace function public.set_submission_status(p_id bigint, p_action text, p_comment text default null, p_confirmed_type text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text := private.my_role();
  v_email text := auth.jwt() ->> 'email';
  v_sub public.submissions;
  v_missing text[];
  v_comment text := nullif(btrim(p_comment), '');
  v_new text;
begin
  if not private.mfa_ok() then raise exception 'Two-step verification (MFA) is required' using errcode = '42501'; end if;
  select * into v_sub from public.submissions where id = p_id for update;
  if v_sub.id is null then raise exception 'Submission not found'; end if;

  if p_action = 'submit' then
    if not (v_role = 'admin' or (v_role = 'country_focal_point' and v_sub.country_iso3 = private.my_country())) then
      raise exception 'Only the country focal point (or the admin) can submit' using errcode = '42501'; end if;
    if v_sub.status not in ('prefilled','draft','returned') then raise exception 'Cannot submit in status %', v_sub.status; end if;
    v_missing := private.missing_fields(p_id);
    if cardinality(v_missing) > 0 then
      raise exception 'Incomplete submission — missing: %', array_to_string(v_missing, '; ') using errcode = '23514'; end if;
    v_new := 'submitted';
    update public.submissions set status = v_new, submitted_at = now(), submitted_by_email = v_email where id = p_id;
  elsif p_action in ('validate','return') then
    if v_role not in ('admin','who_reviewer') then raise exception 'Only WHO can validate or return' using errcode = '42501'; end if;
    if v_sub.status <> 'submitted' then raise exception 'Only submitted reports can be validated or returned (status: %)', v_sub.status; end if;
    if p_action = 'return' then
      if v_comment is null then raise exception 'A comment for the focal point is required when returning'; end if;
      v_new := 'returned';
      update public.submissions set status = v_new, who_comment = v_comment where id = p_id;
    else
      v_missing := private.missing_fields(p_id);
      if cardinality(v_missing) > 0 then
        raise exception 'Incomplete submission — missing: %', array_to_string(v_missing, '; ') using errcode = '23514'; end if;
      if p_confirmed_type is not null and p_confirmed_type not in ('A','B','C') then raise exception 'Invalid readiness type'; end if;
      v_new := 'validated';
      update public.submissions set status = v_new, confirmed_type = coalesce(p_confirmed_type, proposed_type),
             who_comment = v_comment, validated_at = now(), validated_by_email = v_email where id = p_id;
    end if;
  elsif p_action = 'unlock' then
    if v_role <> 'admin' then raise exception 'Only the admin can unlock' using errcode = '42501'; end if;
    if v_sub.status <> 'validated' then raise exception 'Only validated submissions can be unlocked'; end if;
    v_new := 'submitted';
    update public.submissions set status = v_new, validated_at = null, validated_by_email = null where id = p_id;
  else
    raise exception 'Unknown action: %', p_action;
  end if;

  update public.submissions set updated_at = now(), updated_by = auth.uid(), updated_by_email = v_email where id = p_id;
  insert into public.audit_log (user_id, email, submission_id, submission_code, country_iso3, action, detail, old_value, new_value)
  select auth.uid(), v_email, s.id, s.code, s.country_iso3, p_action,
         v_sub.status || ' → ' || v_new || coalesce(' · “' || v_comment || '”', '')
           || case when p_action = 'validate' then ' · type ' || s.confirmed_type else '' end,
         jsonb_build_object('status', v_sub.status, 'confirmed_type', v_sub.confirmed_type, 'who_comment', v_sub.who_comment),
         jsonb_build_object('status', s.status, 'confirmed_type', s.confirmed_type, 'who_comment', s.who_comment)
    from public.submissions s where s.id = p_id;

  return (select to_jsonb(w) from public.v_country_workspace w where w.id = p_id);
end $$;

-- ─────────────────────────── 8. Privileges ───────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant select on public.countries, public.mds_dictionary, public.app_profiles, public.submissions,
                 public.readiness, public.mds_availability, public.indicators, public.audit_log,
                 public.v_country_workspace, public.v_regional to authenticated;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
revoke all on function public.save_submission(text, int, jsonb) from public, anon;
revoke all on function public.set_submission_status(bigint, text, text, text) from public, anon;
grant execute on function public.save_submission(text, int, jsonb) to authenticated;
grant execute on function public.set_submission_status(bigint, text, text, text) to authenticated;

commit;
