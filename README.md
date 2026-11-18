# Studio Ledger

A mobile-friendly project tracker for a music and composition studio. The app can run as a local preview or use Supabase for shared storage and password-protected editing. GitHub Actions deploys the static app to GitHub Pages.

## Local preview

Open `index.html` in a browser or serve this folder with any static file server. With no `config.js` credentials, it starts with sample projects and saves changes in that browser's local storage. This mode is for preview and does not share changes with other people.

## Shared setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. In Supabase Authentication, turn off public signups. Create one editor user with a dedicated email address and a strong password. The app asks for only the password; everyone shares this account until individual accounts are introduced.
4. In the Supabase project settings, copy the Project URL and the `anon` / publishable key. These values are designed to be public in a browser app. Never put a `service_role` key in this repository or in the browser.
5. Create or choose a GitHub repository and push this project to its `main` branch.
6. In that repository, add Actions secrets named `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SHARED_LOGIN_EMAIL` (the email for the shared editor user).
7. In repository Settings → Pages, choose **GitHub Actions** as the build and deployment source. The workflow at `.github/workflows/pages.yml` deploys on each push to `main`.

The password is checked by Supabase Auth, and database access requires an authenticated Supabase session. The shared account means all editors have the same permissions and activity is not attributed to a person. Anyone who knows the password can edit or delete studio data. Create per-person accounts and narrower database policies before using this for sensitive data or needing an audit trail.

## Features

- Overview with deadline, recent update, and name sorting, search, deadline indicators, invoice summaries, task counts, and project status.
- Project details for category, status, deadline, budget, invoice status, team, contacts, and tasks.
- Studio-wide team roster to reuse team member names across projects.
- Realtime refresh for project and team changes from other signed-in editors.
- Responsive layout for phones, tablets, and desktop.
