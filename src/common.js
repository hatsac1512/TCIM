/* ═══════════════════════════════════════════════════════════════════════
   TM1 MDS Dashboard — shared code. build.py inlines this file into every
   embedded page (Regional Dashboard, Country Submission, Review & Validation).

   Two modes, chosen automatically from TM1_CONFIG in index.html (the shell):
     • LIVE  — SUPABASE_URL + SUPABASE_ANON are set: data come from Supabase
               (views v_regional / v_country_workspace, RPCs save_submission /
               set_submission_status). Permissions are enforced by the database
               (row-level security), see tm1_mds_supabase_schema.sql.
     • DEMO  — not configured: an illustrative MOCK-UP that keeps its data in this
               browser (localStorage). The same rules are mirrored in JavaScript
               so the mock-up behaves like the live system.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

const CFG = (() => {
  try { if (window.parent && window.parent !== window && window.parent.TM1_CONFIG) return window.parent.TM1_CONFIG; } catch (e) {}
  return window.TM1_CONFIG || {};
})();
const LIVE = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON);
const SAMPLE = LIVE && !!CFG.SAMPLE_DATA;   // live database holding invented sample data (presentations)
/* live + sample data: show the warning ribbon with a live wording */
function sampleRibbon(el) { if (!SAMPLE || !el) return; el.hidden = false; el.lastElementChild.innerHTML = '<b>Sample data for presentation only.</b> The live system is shown with invented answers and values. They are not real Member State data and must not be quoted.'; }
const SK = { auth: 'tm1_auth', token: 'tm1_token', role: 'tm1_role', country: 'tm1_country', open: 'tm1_open' };
const DEMO_KEY = 'tm1_demo_db_v1';
const THEME_KEY = 'tm1_theme';
const MOTION_KEY = 'tm1_motion';

/* ─────────────────────────── Reference lists ───────────────────────────
   Member States of the WHO Western Pacific Region (areas not included —
   list to be confirmed with the Regional Office). Kept alphabetical:
   the dashboard never ranks countries. */
const COUNTRIES = [
  ['AUS','Australia'],['BRN','Brunei Darussalam'],['KHM','Cambodia'],['CHN','China'],['COK','Cook Islands'],
  ['FJI','Fiji'],['JPN','Japan'],['KIR','Kiribati'],['LAO',"Lao People's Democratic Republic"],['MYS','Malaysia'],
  ['MHL','Marshall Islands'],['FSM','Micronesia (Federated States of)'],['MNG','Mongolia'],['NRU','Nauru'],
  ['NZL','New Zealand'],['NIU','Niue'],['PLW','Palau'],['PNG','Papua New Guinea'],['PHL','Philippines'],
  ['KOR','Republic of Korea'],['WSM','Samoa'],['SGP','Singapore'],['SLB','Solomon Islands'],['TON','Tonga'],
  ['TUV','Tuvalu'],['VUT','Vanuatu'],['VNM','Viet Nam']
];
const CNAME = Object.fromEntries(COUNTRIES);

/* Part 1 — five readiness criteria (concept note) */
const CRITERIA = [
  { k: 'c1', short: 'Providers licensed', label: 'Traditional medicine providers are licensed or registered.' },
  { k: 'c2', short: 'Public facilities', label: 'Traditional medicine services are delivered in public facilities.' },
  { k: 'c3', short: 'Public insurance', label: 'Public health insurance covers traditional medicine services.' },
  { k: 'c4', short: 'TM codes in classification', label: 'The national disease classification contains traditional medicine codes.' },
  { k: 'c5', short: 'Routine capture', label: 'Traditional medicine encounters are captured in routine health information systems or claims.' }
];
const ANSWERS = { no: 'No', partial: 'Partially', full: 'Fully' };

/* Part 2 — tiered MDS: 8 core, 3 expanded, 1 metadata item (concept note) */
const MDS_ITEMS = [
  { k: 'reporting_year', short: 'Reporting year', tier: 'core', label: 'Reporting year' },
  { k: 'facility_type', short: 'Facility type', tier: 'core', label: 'Facility type' },
  { k: 'provider_type', short: 'Provider type', tier: 'core', label: 'Provider type' },
  { k: 'encounter_type', short: 'Encounter type', tier: 'core', label: 'Encounter type' },
  { k: 'age_group', short: 'Age group', tier: 'core', label: 'Age group' },
  { k: 'sex', short: 'Sex', tier: 'core', label: 'Sex' },
  { k: 'tm1_disorder', short: 'TM1 disorder', tier: 'core', label: 'TM1 disorder code' },
  { k: 'tm1_pattern', short: 'TM1 pattern', tier: 'core', label: 'TM1 pattern code' },
  { k: 'icd11_dx', short: 'ICD-11 diagnosis', tier: 'expanded', label: 'Conventional ICD-11 diagnosis' },
  { k: 'intervention', short: 'Intervention', tier: 'expanded', label: 'Type of intervention' },
  { k: 'payment', short: 'Payment source', tier: 'expanded', label: 'Source of payment' },
  { k: 'coding_method', short: 'Coding method', tier: 'metadata', label: 'Coding method (direct TM1 or mapped)' }
];
const TIERS = { core: 'Core', expanded: 'Expanded', metadata: 'Metadata' };
const AVAIL = { available: 'Available', partly: 'Partly', not_available: 'Not available' };
const AVAIL_SYM = { available: '●', partly: '◐', not_available: '○' };

/* Part 3 — six aggregate indicators (concept note). Each value travels with
   source, coverage and coding method. Category lists are DRAFT (mds_dictionary). */
const INDICATORS = [
  { k: 'i1', kind: 'num', unit: 'per 1000 population', label: 'Encounters per 1000 population' },
  { k: 'i2', kind: 'dist2', label: 'Distribution by facility and provider type' },
  { k: 'i3', kind: 'agesex', label: 'Age and sex distribution' },
  { k: 'i4', kind: 'top10', label: 'Ten most frequent TM1 disorders and patterns' },
  { k: 'i5', kind: 'num', unit: '%', label: 'Proportion of encounters with a pattern code' },
  { k: 'i6', kind: 'num', unit: '%', label: 'Dual-coding rate' }
];
const SOURCES = { claims: 'Insurance claims', his: 'Hospital information system', sentinel: 'Sentinel facilities',
  hh_survey: 'Household survey', fac_survey: 'Facility survey', registry: 'Practitioner registry', other: 'Other' };
const COVERAGE = { national: 'National', subnational: 'Subnational', sentinel: 'Sentinel sites', other: 'Other' };
const METHODS = { direct: 'Direct TM1 coding', mapped: 'Mapped from national classification', mixed: 'Mixed (direct + mapped)', other: 'Other' };
/* label of a category, with the text typed for "Other" */
const lbl = (o, k, other) => (o[k] || '') + (k === 'other' && other ? ': ' + other : '');
const FAC_CATS = { hospital: 'Hospital', primary: 'Primary care', private: 'Private TM clinic', other: 'Other' };
const PROV_CATS = { tm_phys: 'TM physician', dual: 'Dual-qualified physician', other_tm: 'Other TM practitioner', other: 'Other' };
const AGE_CATS = { a0_14: '0–14', a15_44: '15–44', a45_64: '45–64', a65: '65+' };

const STATUS = { prefilled: 'Pre-filled (WHO)', draft: 'Draft', submitted: 'Submitted', returned: 'Returned', validated: 'Validated' };
const ROLES = { admin: 'Admin (WHO Regional Office)', who_reviewer: 'WHO reviewer', country_focal_point: 'Country focal point', viewer: 'Viewer' };
const TYPES = { A: 'Data-ready', B: 'Partially ready', C: 'Emerging' };
const YEARS = [2024, 2025, 2026, 2027];

/* ─────────────────────────── Rules ─────────────────────────── */
/* Readiness type — DRAFT rule (System Summary §4, to be agreed with Member States):
   A = all five "Fully"; C = criterion 5 "No" and criterion 1 not "Fully"; B = all other answers. */
function readinessType(r) {
  r = r || {};
  const v = CRITERIA.map(c => (r[c.k] || {}).v);
  if (v.some(x => !x)) return null;
  if (v.every(x => x === 'full')) return 'A';
  if (v[4] === 'no' && v[0] !== 'full') return 'C';
  return 'B';
}
const typeOf = s => (s && (s.confirmedType || s.proposedType || readinessType(s.readiness))) || null;
const num = x => x !== null && x !== undefined && x !== '' && !isNaN(+x);

function hasValue(ind, x) {
  x = x || {}; const d = x.data || {};
  if (ind.kind === 'num') return num(x.value);
  const has = v => num(v) || (typeof v === 'string' && v.trim() !== '');   // indicators 2 and 3 accept a percentage or a short text
  if (ind.kind === 'dist2') return Object.values(d.fac || {}).some(has) || Object.values(d.prov || {}).some(has);
  if (ind.kind === 'agesex') return has(d.female) || Object.values(d.age || {}).some(has);
  if (ind.kind === 'top10') return !!(String(d.disorders || '').trim() || String(d.patterns || '').trim());
  return false;
}
/* What is still missing before "Submit to WHO" (the database runs the same check). */
function missingForSubmit(s) {
  const m = [];
  CRITERIA.forEach((c, i) => { if (!((s.readiness || {})[c.k] || {}).v) m.push({ f: 'r_' + c.k, t: 'Part 1 · criterion ' + (i + 1) }); });
  MDS_ITEMS.forEach(it => {
    const a = (s.availability || {})[it.k] || {};
    if (!a.v) m.push({ f: 'a_' + it.k, t: 'Part 2 · ' + it.label });
    else if (a.v !== 'not_available' && !a.src) m.push({ f: 'as_' + it.k, t: 'Part 2 · ' + it.label + ': data source' });
  });
  INDICATORS.forEach(ind => {
    const x = (s.indicators || {})[ind.k] || {};
    if (x.reported !== true && x.reported !== false) { m.push({ f: 'ir_' + ind.k, t: 'Part 3 · ' + ind.label + ': Reported / Not reported' }); return; }
    if (!x.reported) return;
    if (!hasValue(ind, x)) m.push({ f: 'iv_' + ind.k, t: 'Part 3 · ' + ind.label + ': value' });
    if (!x.src) m.push({ f: 'is_' + ind.k, t: 'Part 3 · ' + ind.label + ': source' });
    if (!x.cov) m.push({ f: 'ic_' + ind.k, t: 'Part 3 · ' + ind.label + ': coverage' });
    if (!x.method) m.push({ f: 'im_' + ind.k, t: 'Part 3 · ' + ind.label + ': coding method' });
  });
  return m;
}

/* Session (written by the shell after login + MFA) */
const sess = {
  get email() { return sessionStorage.getItem(SK.auth) || ''; },
  get role() { return sessionStorage.getItem(SK.role) || 'viewer'; },
  get country() { return sessionStorage.getItem(SK.country) || ''; },
  get token() { return sessionStorage.getItem(SK.token) || ''; }
};
const isWHO = () => ['admin', 'who_reviewer'].includes(sess.role);

/* Permissions — mirror of the database rules (System Summary §6). */
const can = {
  seeDrafts: () => isWHO() || sess.role === 'country_focal_point',
  edit(iso3, st) {
    if (sess.role === 'admin') return st !== 'validated';
    if (sess.role === 'who_reviewer') return !st || st === 'prefilled';
    if (sess.role === 'country_focal_point') return iso3 === sess.country && (!st || ['prefilled', 'draft', 'returned'].includes(st));
    return false;
  },
  submit(iso3, st) {
    if (!['prefilled', 'draft', 'returned'].includes(st)) return false;
    return sess.role === 'admin' || (sess.role === 'country_focal_point' && iso3 === sess.country);
  },
  decide: st => isWHO() && st === 'submitted',
  unlock: st => sess.role === 'admin' && st === 'validated'
};
function statusAfterSave(prev) {
  if (sess.role === 'who_reviewer') return 'prefilled';
  if (sess.role === 'admin') return prev || 'draft';
  return 'draft';
}

/* ─────────────────────────── Icons (thin-stroke SVG, 24×24) ─────────────────────────── */
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  bars: '<path d="M3 21h18"/><rect x="5" y="11" width="3" height="7" rx="1"/><rect x="10.5" y="6" width="3" height="12" rx="1"/><rect x="16" y="13" width="3" height="5" rx="1"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
  send: '<path d="m4 12 16-8-6 16-3-7z"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
};
const icon = (name, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';

/* ─────────────────────────── Utilities ─────────────────────────── */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const codeOf = (iso3, year) => 'TM1-' + iso3 + '-' + year;
const fmtNum = (v, d) => num(v) ? (+v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d }) : '—';
function fmtDT(t) { if (!t) return '—'; const d = new Date(t); if (isNaN(d)) return esc(t); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
let _tt = null;
function toast(text, bad) {
  let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = text; t.classList.toggle('bad', !!bad); t.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), bad ? 6000 : 3500);
}
function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  window.dispatchEvent(new Event('tm1-theme'));
}
addEventListener('storage', e => {
  if (e.key === THEME_KEY) { document.documentElement.setAttribute('data-theme', e.newValue === 'dark' ? 'dark' : 'light'); window.dispatchEvent(new Event('tm1-theme')); }
  if (e.key === MOTION_KEY) document.documentElement.setAttribute('data-motion', e.newValue === 'off' ? 'off' : 'on');
  if (e.key === DEMO_KEY) window.dispatchEvent(new Event('tm1-data'));
});
/* The shell posts {type:'tm1-show'} when this tab becomes visible → replay the entrance, refresh. */
addEventListener('message', e => {
  if (e.data && e.data.type === 'tm1-show') { _enterPending = true; window.dispatchEvent(new Event('tm1-enter')); window.dispatchEvent(new Event('tm1-data')); }
});

/* ── Motion mode (toggle in the shell top bar; off = no animation) ──
   enter(): visible blocks rise in one after another. entered(): run it once after the page has
   rendered its data (on first load and each time the tab is shown). tween()/countUp(): numbers count. */
const motionOn = () => document.documentElement.getAttribute('data-motion') === 'on';
const ENTER_SEL = '.page-h,.demo-rib,.note-band,.bnr,.kpi,.seg-nav,.cc';
let _enterPending = true;
function enter(root) {
  if (!motionOn()) return;
  const els = [...(root || document).querySelectorAll(ENTER_SEL)].filter(e => e.getClientRects().length && e.getBoundingClientRect().top < innerHeight + 80);
  els.forEach((e, i) => { e.classList.remove('mo-i'); e.style.setProperty('--i', Math.min(i, 10)); });
  void document.body.offsetWidth;   // restart the CSS animation
  els.forEach(e => e.classList.add('mo-i'));
  setTimeout(() => els.forEach(e => e.classList.remove('mo-i')), 1600);
}
function entered() { if (_enterPending) { _enterPending = false; enter(); } }
function tween(el, to, from, suf) {
  suf = suf || ''; to = +to || 0; from = from == null ? 0 : +from;
  const tok = el._tw = (el._tw || 0) + 1;
  if (!motionOn() || from === to) { el.textContent = to + suf; return; }
  const t0 = performance.now() + (_enterPending ? 250 : 0), D = 1100;   // wait for the entrance, then count
  const step = now => { if (el._tw !== tok) return; const p = Math.max(0, Math.min(1, (now - t0) / D)), k = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * k) + suf; if (p < 1) requestAnimationFrame(step); };
  el.textContent = from + suf; requestAnimationFrame(step);
}
/* Elements with data-to (and optional data-k key, data-suf suffix); prev = {key: last value}, updated in place. */
function countUp(root, prev) {
  root.querySelectorAll('[data-to]').forEach((el, i) => { const k = el.dataset.k || i, to = +el.dataset.to; tween(el, to, prev ? prev[k] : 0, el.dataset.suf); if (prev) prev[k] = to; });
}
function goTab(view, open) {
  try { if (open) sessionStorage.setItem(SK.open, JSON.stringify(open)); window.parent.TM1_SHELL.showView(view); } catch (e) { toast('Could not switch tab: ' + e.message, true); }
}
function setLive(state, msg) {
  const c = $('liveChip'), t = $('liveTxt'); if (!c || !t) return;
  c.className = 'live' + (LIVE ? '' : ' demo') + (state === 'err' ? ' err' : '');
  t.textContent = state === 'err' ? 'Error' : (state === 'syn' ? 'Loading…' : (LIVE ? (SAMPLE ? 'Live · sample data' : 'Live · Supabase') : 'Demo · mock-up'));
  c.title = msg || (LIVE ? 'Connected to Supabase' : 'Illustrative data stored in this browser only');
}

/* ─────────────────────────── DEMO data (illustrative) ─────────────────────────── */
function seedDB() {
  const subs = [];
  let id = 0;
  const A = { a: 'available', p: 'partly', n: 'not_available' };
  const R = { f: 'full', p: 'partial', n: 'no' };
  const DIS = ['Low back pain disorder', 'Headache disorder', 'Insomnia disorder', 'Functional dyspepsia disorder', 'Knee joint pain disorder', 'Common cold disorder'];
  const PAT = ['Qi deficiency pattern', 'Blood stasis pattern', 'Liver qi stagnation pattern', 'Spleen qi deficiency pattern', 'Kidney yang deficiency pattern', 'Wind-cold pattern'];
  /* r: 5 letters f/p/n · av: 12 letters a/p/n · src: default data source · iv: indicator values */
  function mk(iso3, year, status, r, av, src, meta, iv, extra) {
    const readiness = {}, availability = {}, indicators = {};
    CRITERIA.forEach((c, i) => { readiness[c.k] = { v: R[r[i]], note: '' }; });
    MDS_ITEMS.forEach((it, i) => { const v = A[av[i]]; availability[it.k] = { v, src: v === 'not_available' ? '' : src }; });
    INDICATORS.forEach(ind => {
      const v = iv[ind.k];
      if (v === undefined) { indicators[ind.k] = { reported: false }; return; }
      const x = { reported: true, src: meta.src, cov: meta.cov, covNote: meta.covNote || '', method: meta.method };
      if (ind.kind === 'num') x.value = v;
      if (ind.kind === 'dist2') x.data = { fac: { hospital: v[0][0], primary: v[0][1], private: v[0][2], other: v[0][3] }, prov: { tm_phys: v[1][0], dual: v[1][1], other_tm: v[1][2], other: v[1][3] } };
      if (ind.kind === 'agesex') x.data = { female: v[0], age: { a0_14: v[1][0], a15_44: v[1][1], a45_64: v[1][2], a65: v[1][3] } };
      if (ind.kind === 'top10') x.data = { disorders: DIS.slice(0, v).join('\n'), patterns: PAT.slice(0, v).join('\n') };
      indicators[ind.k] = x;
    });
    readiness.c1.note = extra && extra.note ? extra.note : '';
    const t = new Date(year, 3 + (id % 5), 3 + (id % 20)).toISOString();
    const s = { id: ++id, code: codeOf(iso3, year), iso3, year, status, readiness, availability, indicators,
      proposedType: readinessType(readiness), confirmedType: null, comment: (extra && extra.comment) || '',
      createdAt: t, createdBy: 'seed', updatedAt: t, updatedBy: 'focal.' + iso3.toLowerCase() + '@demo.local',
      submittedAt: ['submitted', 'validated'].includes(status) ? t : null, submittedBy: null, validatedAt: status === 'validated' ? t : null, validatedBy: status === 'validated' ? 'reviewer@demo.local' : null };
    if (status === 'validated') s.confirmedType = s.proposedType;
    if (status === 'prefilled') s.updatedBy = 'reviewer@demo.local';
    subs.push(s);
  }
  const claimsNat = { src: 'claims', cov: 'national', method: 'mapped' };
  const hisSub = { src: 'his', cov: 'subnational', method: 'direct', covNote: 'Public TM hospitals reporting to the national system' };
  const sent = n => ({ src: 'sentinel', cov: 'sentinel', method: 'direct', covNote: n + ' sentinel facilities' });
  const survey = { src: 'hh_survey', cov: 'national', method: 'mapped', covNote: 'National health survey module' };
  // 2025
  mk('KOR', 2025, 'validated', 'fffff', 'aaaaaapaaapa', 'claims', claimsNat, { i1: 388.2, i2: [[38, 52, 6, 4], [91, 6, 0, 3]], i3: [61, [6, 31, 34, 29]], i4: 6, i5: 72.4, i6: 41.0 });
  mk('CHN', 2025, 'validated', 'fffff', 'aaaaaaaapapa', 'his', hisSub, { i1: 296.5, i2: [[71, 24, 3, 2], [80, 14, 4, 2]], i3: [55, [9, 33, 35, 23]], i4: 6, i5: 64.8, i6: 58.3 });
  mk('JPN', 2025, 'validated', 'fffnp', 'aaaapannppan', 'claims', { src: 'claims', cov: 'national', method: 'mixed' }, { i1: 120.6, i3: [63, [4, 28, 36, 32]] });
  mk('MYS', 2025, 'validated', 'fppnp', 'apaapapnnpnp', 'sentinel', sent(12), { i1: 18.4, i3: [58, [7, 39, 37, 17]] });
  mk('MNG', 2025, 'validated', 'fpppp', 'appappnnpnnp', 'his', { src: 'his', cov: 'subnational', method: 'mapped', covNote: 'National Centre of TM + 6 provinces' }, { i1: 41.7 });
  mk('SGP', 2025, 'validated', 'fpnnn', 'apnnpnnnnnnn', 'fac_survey', { src: 'fac_survey', cov: 'national', method: 'mapped' }, {});
  mk('PHL', 2025, 'validated', 'fpppn', 'apnnppnnnnnn', 'registry', { src: 'registry', cov: 'national', method: 'mapped' }, {});
  mk('VNM', 2025, 'validated', 'ffppp', 'aaaaaappapap', 'his', { src: 'his', cov: 'subnational', method: 'mapped', covNote: 'Provincial TM hospitals' }, { i1: 152.3, i2: [[83, 14, 2, 1], [76, 19, 3, 2]], i3: [57, [5, 30, 38, 27]] });
  mk('FJI', 2025, 'validated', 'nnnnn', 'apnnppnnnnnn', 'hh_survey', survey, {});
  mk('WSM', 2025, 'validated', 'pnnnn', 'apnnppnnnnnn', 'hh_survey', survey, { i1: 9.8 });
  // 2026
  mk('KOR', 2026, 'validated', 'fffff', 'aaaaaaaaaapa', 'claims', claimsNat, { i1: 401.9, i2: [[37, 53, 6, 4], [90, 7, 0, 3]], i3: [61, [6, 30, 34, 30]], i4: 6, i5: 75.1, i6: 44.6 });
  mk('CHN', 2026, 'validated', 'fffff', 'aaaaaaaaaapa', 'his', hisSub, { i1: 305.0, i2: [[70, 25, 3, 2], [79, 15, 4, 2]], i3: [55, [9, 32, 35, 24]], i4: 6, i5: 68.2, i6: 61.7 });
  mk('JPN', 2026, 'validated', 'fffnp', 'aaaapannppap', 'claims', { src: 'claims', cov: 'national', method: 'mixed' }, { i1: 123.4, i3: [63, [4, 27, 36, 33]] });
  mk('MYS', 2026, 'validated', 'fppnp', 'aaaapappnpnp', 'sentinel', sent(20), { i1: 21.0, i2: [[64, 30, 6, 0], [55, 10, 35, 0]], i3: [58, [7, 38, 37, 18]], i5: 22.5 });
  mk('MNG', 2026, 'validated', 'fpppp', 'aaaappnnpnnp', 'his', { src: 'his', cov: 'subnational', method: 'mapped', covNote: 'National Centre of TM + 9 provinces' }, { i1: 44.1, i3: [59, [10, 36, 33, 21]] });
  mk('AUS', 2026, 'validated', 'fpnnn', 'apnnppnnnnnn', 'hh_survey', survey, { i1: 35.2 });
  mk('PHL', 2026, 'submitted', 'fpppn', 'appnppnnnnnp', 'registry', { src: 'registry', cov: 'national', method: 'mapped' }, { i1: 6.3 });
  mk('VNM', 2026, 'draft', 'ffffp', 'aaaaaaapapap', 'his', { src: 'his', cov: 'subnational', method: 'mapped', covNote: 'Provincial TM hospitals' }, { i1: 160.8, i3: [57, [5, 29, 38, 28]] });
  mk('FJI', 2026, 'returned', 'pnnnn', 'apnnppnnnnnn', 'hh_survey', survey, {}, { comment: 'Please add the source for criterion 1 (practitioner registration) and confirm whether the 2026 household survey covers TM use.' });
  mk('SLB', 2026, 'validated', 'nnnnn', 'apnnppnnnnnn', 'hh_survey', survey, {});
  mk('WSM', 2026, 'validated', 'pnnnn', 'apnnppnnnnnn', 'hh_survey', survey, { i1: 10.4 });
  mk('KHM', 2026, 'validated', 'ppnnn', 'apnnppnnnnnn', 'fac_survey', { src: 'fac_survey', cov: 'subnational', method: 'mapped' }, {});
  mk('LAO', 2026, 'validated', 'pppnn', 'apnnppnnnnnn', 'his', { src: 'his', cov: 'subnational', method: 'mapped' }, {});
  mk('TON', 2026, 'prefilled', 'pnnnn', 'apnnnnnnnnnn', 'hh_survey', survey, {});
  return { v: 1, seq: id, subs, audit: [] };
}
const Demo = {
  load() {
    let db = null; try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) {}
    if (!db || db.v !== 1) { db = seedDB(); this.store(db); }
    return db;
  },
  store(db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { throw new Error('Browser storage is not available — the demo cannot save.'); } },
  log(db, s, action, detail) { db.audit.unshift({ at: new Date().toISOString(), by: sess.email, action, code: s.code, subId: s.id, detail: detail || '' }); db.audit = db.audit.slice(0, 500); }
};
const clone = o => JSON.parse(JSON.stringify(o));
function diffParts(a, b) {
  const out = [];
  const walk = (label, x, y, keys) => keys.forEach(k => { if (JSON.stringify((x || {})[k] || {}) !== JSON.stringify((y || {})[k] || {})) out.push(label + ' ' + k); });
  walk('Part 1', a.readiness, b.readiness, CRITERIA.map(c => c.k));
  walk('Part 2', a.availability, b.availability, MDS_ITEMS.map(i => i.k));
  walk('Part 3', a.indicators, b.indicators, INDICATORS.map(i => i.k));
  return out;
}
const demoApi = {
  async regional() { return clone(Demo.load().subs.filter(s => s.status === 'validated')); },
  async workspace() {
    const all = Demo.load().subs;
    if (isWHO()) return clone(all);
    if (sess.role === 'country_focal_point') return clone(all.filter(s => s.iso3 === sess.country));
    return [];
  },
  async save(iso3, year, parts) {
    const db = Demo.load();
    let s = db.subs.find(x => x.iso3 === iso3 && x.year === year);
    if (!can.edit(iso3, s && s.status)) throw new Error('Not allowed: this submission cannot be edited with your role or in its current status.');
    const now = new Date().toISOString();
    if (!s) { s = { id: ++db.seq, code: codeOf(iso3, year), iso3, year, createdAt: now, createdBy: sess.email, comment: '', confirmedType: null }; db.subs.push(s); }
    const changed = diffParts(s, parts);
    const prev = s.status;
    Object.assign(s, { readiness: parts.readiness, availability: parts.availability, indicators: parts.indicators,
      proposedType: readinessType(parts.readiness), status: statusAfterSave(prev), updatedAt: now, updatedBy: sess.email });
    Demo.log(db, s, prev ? 'save' : 'create', (prev && prev !== s.status ? STATUS[prev] + ' → ' + STATUS[s.status] + '. ' : '') + (changed.length ? 'Changed: ' + changed.join(', ') : 'No field changes'));
    Demo.store(db); return clone(s);
  },
  async setStatus(id, action, o) {
    o = o || {};
    const db = Demo.load(); const s = db.subs.find(x => x.id === id);
    if (!s) throw new Error('Submission not found.');
    const prev = s.status, now = new Date().toISOString();
    if (action === 'submit') {
      if (!can.submit(s.iso3, prev)) throw new Error('Not allowed to submit in status ' + STATUS[prev] + '.');
      const miss = missingForSubmit(s); if (miss.length) throw new Error('Incomplete — ' + miss.length + ' required field(s) missing.');
      Object.assign(s, { status: 'submitted', submittedAt: now, submittedBy: sess.email });
    } else if (action === 'validate' || action === 'return') {
      if (!can.decide(prev)) throw new Error('Only WHO can validate or return a submitted report.');
      if (action === 'return' && !String(o.comment || '').trim()) throw new Error('A comment for the focal point is required when returning.');
      if (action === 'validate') Object.assign(s, { status: 'validated', confirmedType: o.confirmedType || s.proposedType, validatedAt: now, validatedBy: sess.email });
      else s.status = 'returned';
      s.comment = String(o.comment || '').trim();
    } else if (action === 'unlock') {
      if (!can.unlock(prev)) throw new Error('Only the admin can unlock a validated submission.');
      Object.assign(s, { status: 'submitted', validatedAt: null, validatedBy: null });
    } else throw new Error('Unknown action');
    s.updatedAt = now; s.updatedBy = sess.email;
    Demo.log(db, s, action, STATUS[prev] + ' → ' + STATUS[s.status] + (o.comment ? ' · “' + o.comment + '”' : '') + (action === 'validate' ? ' · type ' + s.confirmedType : ''));
    Demo.store(db); return clone(s);
  },
  async audit(subId) {
    const db = Demo.load();
    let list = db.audit;
    if (subId) list = list.filter(a => a.subId === subId);
    else if (sess.role === 'country_focal_point') list = list.filter(a => (a.code || '').indexOf('-' + sess.country + '-') > 0);
    else if (!isWHO()) list = [];
    return clone(list.slice(0, 200));
  },
  reset() { Demo.store(seedDB()); }
};

/* ─────────────────────────── LIVE (Supabase REST) ─────────────────────────── */
async function rest(path, opts) {
  opts = opts || {};
  const token = sess.token;
  if (!token) throw new Error('Not signed in — please log in again.');
  let r;
  try {
    r = await fetch(CFG.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, {
      method: opts.method || 'GET', cache: 'no-store',
      headers: { apikey: CFG.SUPABASE_ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
  } catch (e) { throw new Error('Network error reaching Supabase: ' + (e.message || 'blocked')); }
  if (!r.ok) {
    let d = ''; try { const j = await r.json(); d = j.message || j.hint || ''; } catch (_) {}
    if (r.status === 401 || r.status === 403) throw new Error('Access denied (HTTP ' + r.status + '): your session may have expired — log out and log in again. ' + d);
    throw new Error('HTTP ' + r.status + ' from Supabase. ' + d);
  }
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
function fromRow(w) {
  if (!w) return null;
  return { id: w.id, code: w.code, iso3: w.country_iso3, year: w.reporting_year, status: w.status,
    proposedType: w.proposed_type, confirmedType: w.confirmed_type, comment: w.who_comment || '',
    readiness: w.readiness || {}, availability: w.availability || {}, indicators: w.indicators || {},
    createdAt: w.created_at, updatedAt: w.updated_at, updatedBy: w.updated_by_email,
    submittedAt: w.submitted_at, submittedBy: w.submitted_by_email, validatedAt: w.validated_at, validatedBy: w.validated_by_email };
}
const liveApi = {
  async regional() { return (await rest('v_regional?select=*')).map(fromRow); },
  async workspace() { return (await rest('v_country_workspace?select=*')).map(fromRow); },
  async save(iso3, year, parts) { return fromRow(await rest('rpc/save_submission', { method: 'POST', body: { p_country: iso3, p_year: year, p_data: parts } })); },
  async setStatus(id, action, o) { o = o || {}; return fromRow(await rest('rpc/set_submission_status', { method: 'POST', body: { p_id: id, p_action: action, p_comment: o.comment || null, p_confirmed_type: o.confirmedType || null } })); },
  async audit(subId) {
    const rows = await rest('audit_log?select=*&order=at.desc&limit=200' + (subId ? '&submission_id=eq.' + subId : ''));
    return rows.map(a => ({ at: a.at, by: a.email, action: a.action, code: a.submission_code, subId: a.submission_id, detail: a.detail || '' }));
  },
  reset() {}
};

/* ─────────────────────────── Country Profile (shared renderer) ─────────────────────────── */
function chipA(v) { return v ? '<span class="chip a-' + v + '">' + ANSWERS[v] + '</span>' : '<span class="chip a-none">—</span>'; }
function chipAv(v) { return v ? '<span class="chip av-' + v + '">' + AVAIL[v] + '</span>' : '<span class="chip a-none">—</span>'; }
function typeBadge(t) { return t ? '<span class="type t' + t + '" title="' + TYPES[t] + '">' + t + '</span>' : '<span class="type tN" title="No data">–</span>'; }
function stBadge(st) { return st ? '<span class="st st-' + st + '">' + STATUS[st] + '</span>' : '<span class="st st-draft">Not started</span>'; }
function metaLine(x) {
  if (!x || !x.reported) return '';
  return '<span class="meta">Source: ' + esc(lbl(SOURCES, x.src, x.srcOther) || '—') + ' · Coverage: ' + esc(COVERAGE[x.cov] || '—') + (x.covNote ? ' (' + esc(x.covNote) + ')' : '') + ' · Coding: ' + esc(lbl(METHODS, x.method, x.methodOther) || '—') + '</span>';
}
const pctTxt = v => num(v) ? fmtNum(v) + '%' : v ? esc(v) : '—';   // a percentage, or the text entered instead
function pctTable(title, cats, obj) {
  obj = obj || {};
  const cells = Object.entries(cats).map(([k, l]) => '<tr><td>' + esc(l) + '</td><td class="c">' + pctTxt(obj[k]) + '</td></tr>').join('');
  return '<table><tr><th>' + esc(title) + '</th><th>%</th></tr>' + cells + '</table>';
}
function indBody(ind, x) {
  if (!x || x.reported !== true) return '<div class="muted">' + (x && x.reported === false ? 'Not reported' : 'Not answered') + '</div>';
  const d = x.data || {};
  if (ind.kind === 'num') return '<div class="val">' + fmtNum(x.value) + ' <small class="muted">' + esc(ind.unit) + '</small></div>';
  if (ind.kind === 'dist2') return '<div class="pgrid">' + pctTable('Facility type', FAC_CATS, d.fac) + pctTable('Provider type', PROV_CATS, d.prov) + '</div>';
  if (ind.kind === 'agesex') return '<div>Female: <b>' + pctTxt(d.female) + '</b></div>' + pctTable('Age group', AGE_CATS, d.age);
  if (ind.kind === 'top10') {
    const ol = s => { const a = String(s || '').split('\n').map(t => t.trim()).filter(Boolean); return a.length ? '<ol style="padding-left:18px">' + a.slice(0, 10).map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' : '<span class="muted">—</span>'; };
    return '<div class="pgrid"><div><b>Disorders</b>' + ol(d.disorders) + '</div><div><b>Patterns</b>' + ol(d.patterns) + '</div></div>';
  }
  return '';
}
function profileHTML(s) {
  const t = typeOf(s);
  let h = '<div class="prof"><div class="ph"><h2>' + esc(CNAME[s.iso3] || s.iso3) + '</h2>' + typeBadge(t) + '<span>' + (t ? TYPES[t] : 'Type not determined') + '</span>' + stBadge(s.status) +
    '<span class="muted">' + esc(s.code) + ' · reporting year ' + esc(s.year) + '</span></div>';
  h += '<div class="muted" style="font-size:.74rem">Last updated ' + fmtDT(s.updatedAt) + (s.validatedAt ? ' · validated ' + fmtDT(s.validatedAt) : '') + '</div>';
  if (s.comment) h += '<div class="cmt"><b>WHO comment:</b> ' + esc(s.comment) + '</div>';
  h += '<h4>Part 1 · Data readiness</h4><table><tr><th>#</th><th>Criterion</th><th>Answer</th><th>Evidence / source</th></tr>' +
    CRITERIA.map((c, i) => { const r = (s.readiness || {})[c.k] || {}; return '<tr><td>' + (i + 1) + '</td><td>' + esc(c.label) + '</td><td>' + chipA(r.v) + '</td><td>' + esc(r.note || '') + '</td></tr>'; }).join('') + '</table>';
  h += '<div style="margin-top:6px;font-size:.78rem">Proposed type (system): <b>' + (s.proposedType || readinessType(s.readiness) || '—') + '</b> · Confirmed by WHO: <b>' + (s.confirmedType || '—') + '</b></div>';
  h += '<h4>Part 2 · MDS availability</h4><table><tr><th>Tier</th><th>MDS item</th><th>Availability</th><th>Data source</th></tr>' +
    MDS_ITEMS.map(it => { const a = (s.availability || {})[it.k] || {}; return '<tr><td>' + TIERS[it.tier] + '</td><td>' + esc(it.label) + '</td><td>' + chipAv(a.v) + '</td><td>' + esc(lbl(SOURCES, a.src, a.srcOther)) + '</td></tr>'; }).join('') + '</table>';
  h += '<h4>Part 3 · Aggregate indicators</h4><div class="pgrid">' +
    INDICATORS.map(ind => { const x = (s.indicators || {})[ind.k]; return '<div class="ind"><b>' + esc(ind.label) + '</b>' + indBody(ind, x) + metaLine(x) + '</div>'; }).join('') + '</div></div>';
  return h;
}
const PRINT_CSS = "body{font-family:'IBM Plex Sans',Arial,sans-serif;color:#1f2d3d;margin:24px;font-size:12px}h1{font-size:16px;color:#101828;margin:0;font-weight:600}h2{font-size:18px;margin:0;color:#101828;font-weight:600}h4{color:#1F6FEB;text-transform:uppercase;font-size:11px;letter-spacing:1px;margin:16px 0 6px;font-weight:600}" +
  'table{width:100%;border-collapse:collapse;margin:4px 0}th,td{border:1px solid #cdd7e3;padding:4px 6px;text-align:left;vertical-align:top}th{background:#e3e9f2;font-size:10px;text-transform:uppercase}' +
  '.ph{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0}.chip,.st{border:1px solid #999;border-radius:8px;padding:1px 7px;font-size:10px;font-weight:bold}.type{border:1px solid #333;border-radius:6px;padding:2px 7px;font-weight:bold}' +
  '.pgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ind{border:1px solid #cdd7e3;border-radius:8px;padding:8px;break-inside:avoid}.val{font-size:16px;font-weight:bold}.meta{display:block;font-size:10px;color:#56657a;margin-top:3px}.muted{color:#56657a}' +
  '.cmt{border:1px solid #e9a0b0;background:#fdf0f3;padding:6px 8px;border-radius:6px;margin-top:6px}.ban{border:2px solid #d97706;color:#b45309;padding:6px 10px;font-weight:bold;margin:10px 0;border-radius:6px}' +
  '.foot{margin-top:18px;font-size:10px;color:#56657a;border-top:1px solid #cdd7e3;padding-top:6px}@media print{body{margin:10mm}}';
function printProfile(s) {
  const bans = [];
  if (!LIVE || SAMPLE) bans.push('MOCK-UP — ILLUSTRATIVE DATA ONLY. Not real Member State data.');
  if (s.status !== 'validated') bans.push('DRAFT (status: ' + STATUS[s.status] + ') — not validated by WHO. For internal use only.');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(s.code) + ' · Country Profile</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet"><style>' + PRINT_CSS + '</style></head><body>' +
    '<h1>TM1 MDS Dashboard — Country Profile</h1><div class="muted">Regional dashboard on minimum data sets for ICD-11 Traditional Medicine Module 1 · WHO Western Pacific Region</div>' +
    bans.map(b => '<div class="ban">' + esc(b) + '</div>').join('') + profileHTML(s) +
    '<div class="foot">Printed ' + fmtDT(new Date().toISOString()) + ' by ' + esc(sess.email) + '. Aggregate national data only. Each indicator must be read with its source, coverage and coding method.</div>' +
    '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);};</scr' + 'ipt></body></html>';
  const w = window.open('', '_blank');
  if (!w) { toast('The browser blocked the print window — allow pop-ups for this page and try again.', true); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

window.TM1 = {
  CFG, LIVE, SAMPLE, sampleRibbon, SK, COUNTRIES, CNAME, CRITERIA, ANSWERS, MDS_ITEMS, TIERS, AVAIL, AVAIL_SYM, INDICATORS, SOURCES, COVERAGE, METHODS, lbl,
  FAC_CATS, PROV_CATS, AGE_CATS, STATUS, ROLES, TYPES, YEARS,
  readinessType, typeOf, hasValue, missingForSubmit, num, sess, isWHO, can,
  $, esc, codeOf, fmtNum, fmtDT, toast, toggleTheme, goTab, setLive, icon,
  motionOn, enter, entered, tween, countUp, enterPending: () => _enterPending,
  chipA, chipAv, typeBadge, stBadge, metaLine, profileHTML, printProfile,
  api: LIVE ? liveApi : demoApi
};
})();
