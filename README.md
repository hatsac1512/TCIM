# ICD-11 TM1 minimum data set dashboard — prototype

A prototype regional dashboard on minimum data sets (MDS) for ICD-11 Traditional Medicine Module 1 (TM1) in the Western Pacific Region. Member States report three things for each reporting year:

1. **Data readiness**: five criteria that place a country in type A (data-ready), B (partially ready) or C (emerging).
2. **MDS availability**: which of the 12 MDS items the country can report now, and from which source.
3. **Aggregate indicators**: six indicators. Each one carries its source, coverage and coding method.

> **Sample data only.** The connected database holds invented answers and values that show how the system works. They are **not real Member State data** and must not be quoted. Every page shows this notice.

## Open it

- `index.html`: the dashboard, standard design.
- `index_glass.html`: the same dashboard in the "Liquid Glass" design.

Both are single static files. No server is needed: open them in a browser, or publish the repository with GitHub Pages.

Accounts are created by the administrator. Visitors cannot sign up. Every account must pass two-step verification (an authenticator app) before it can read any data.

## How it works

| Part | What it does |
|---|---|
| Static pages (`src/` → `index*.html`) | Regional Dashboard, Country Submission, Review & Validation |
| Supabase Auth | Email + password, then a 6-digit TOTP code (MFA) |
| Supabase Postgres | Tables, views and two write functions. Row-level security enforces the roles: admin, WHO reviewer, country focal point, viewer |

The page contains only the project URL and the **publishable** key. That key is public by design. The data are protected by row-level security and MFA, not by keeping the key secret. A secret or `service_role` key must never be put in the page.

## Files

| File | Purpose |
|---|---|
| `src/` | Source of the pages. Edit these files, never the built `index*.html`. |
| `src/build.py` | Builds the pages (needs Python 3 and Pillow) |
| `who-wpro-logo-new.png` | Logo embedded by the build |
| `tm1_mds_supabase_schema.sql` | Complete database: tables, roles, row-level security, MFA rule, audit log |
| `tm1_setup_admin.sql` | Gives the first account the admin role |
| `tm1_sample_data.sql` | Loads the invented sample data (only into an empty database) |
| `tm1_remove_sample_data.sql` | Removes the sample data and demo accounts before real use |

## Build

```
cd src
python build.py              # → ../index.html
python build.py glass        # → ../index_glass.html
python build.py demo         # → ../index_demo.html: no database, illustrative data kept in the browser
python build.py glass demo   # → ../index_glass_demo.html
```

## Use your own Supabase project

1. Create a project. In the SQL editor, run `tm1_mds_supabase_schema.sql` once.
2. Authentication: turn off "Allow new users to sign up". Keep TOTP multi-factor authentication enabled.
3. Authentication → Users → Add user (tick Auto Confirm). Then run `tm1_setup_admin.sql` with that email.
4. In `src/shell.html` (`TM1_CONFIG`), set `SUPABASE_URL` and the publishable key in `SUPABASE_ANON`. Rebuild.
5. Optional: run `tm1_sample_data.sql` for a demonstration. Keep `SAMPLE_DATA: true` while sample data are loaded. Before real data collection, run `tm1_remove_sample_data.sql`, set `SAMPLE_DATA: false` and rebuild.
