# CE Final Projects Management System

A bilingual (Hebrew/English) web application for managing final-year Computer
Engineering projects: faculty submit project proposals, staff review and
approve them, students register for approved projects, and academic
supervisors approve/reject student registrations — all with email
notifications at every step.

Built with **Next.js 16** (App Router), **Supabase** (Postgres + Auth),
**shadcn/ui** (Base UI), **Tailwind CSS v4**, and **next-intl** for
localization.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Core Concepts](#core-concepts)
- [Getting Started (Developers)](#getting-started-developers)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Seeding Demo Data](#seeding-demo-data)
- [Running the App](#running-the-app)
- [User Guide](#user-guide)
- [Admin Guide](#admin-guide)
- [Email Notifications](#email-notifications)
- [Academic Years (Archiving)](#academic-years-archiving)
- [API Reference](#api-reference)
- [Internationalization](#internationalization)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Overview

This system replaces an ad-hoc spreadsheet/email process for managing final
projects in a Computer Engineering program. It supports the full lifecycle
of a project:

1. **Proposal** — A faculty supervisor submits a project proposal (title,
   abstract, objective, scope, prerequisites, references, etc.).
2. **Review** — Course staff review the proposal. They can:
   - **Approve** it (assigns a project number and publishes it),
   - **Send it back for revision** (with notes, via an edit link emailed to
     the supervisor), or
   - **Reject** it.
3. **Registration** — Once approved and unassigned, students can register
   for the project (individually or in pairs).
4. **Registration approval** — The project's academic supervisor receives an
   email with **Approve/Reject** buttons to decide on the registration.
5. **Assignment** — Approved registrations show up in the "Assigned
   Projects" page with the project number and (partially redacted) student
   IDs.

The whole flow supports **multiple academic years**, so staff can archive a
year, start a new one, and optionally "carry over" unused approved projects
into the new year.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| Database / Auth | [Supabase](https://supabase.com) (Postgres, magic-link/OTP auth) |
| UI Components | [shadcn/ui](https://ui.shadcn.com) on top of [Base UI](https://base-ui.com) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Forms & Validation | [react-hook-form](https://react-hook-form.com) + [Zod v4](https://zod.dev) |
| Localization | [next-intl](https://next-intl-docs.vercel.app) (Hebrew + English, RTL/LTR) |
| Email | [Nodemailer](https://nodemailer.com) (via Gmail SMTP) |
| Toasts | [Sonner](https://sonner.emilkowal.ski) |
| Icons | [lucide-react](https://lucide.dev) |

---

## Project Structure

```
.
├── public/
│   └── project-regulations.pdf       # Linked from the nav "Regulations" button
├── scripts/
│   ├── seed.mjs                      # Demo data seed script (Hebrew content)
│   └── projects.json                 # Plain English sample project data
├── supabase/
│   ├── schema.sql                    # Full DB schema — run once on a fresh project
│   └── migrations/                   # Incremental SQL migrations (run in order)
├── src/
│   ├── app/
│   │   ├── [locale]/                 # Public, localized pages (he/en)
│   │   │   ├── page.tsx              # Landing page
│   │   │   ├── propose/              # Proposal submission + edit-via-token
│   │   │   ├── register/             # Student registration form
│   │   │   ├── projects/             # Browse approved projects (by cluster)
│   │   │   ├── assigned/             # View assigned/taken projects
│   │   │   └── layout.tsx            # Locale layout (header, RTL/LTR, toaster)
│   │   ├── admin/                    # Staff-only dashboard (NOT localized — Hebrew UI)
│   │   │   ├── layout.tsx            # Auth gate (magic link / OTP) + sidebar nav
│   │   │   ├── pending/              # Review pending/returned proposals
│   │   │   ├── projects/             # Manage all projects (any status)
│   │   │   ├── registrations/        # Manage student registrations
│   │   │   ├── reports/              # CSV/Excel exports
│   │   │   ├── settings/             # Academic year management
│   │   │   └── year-context.tsx      # React context for the selected academic year
│   │   ├── approve-registration/[token]/  # Supervisor's one-click approve/reject page
│   │   ├── auth/callback/            # Supabase auth callback handler
│   │   └── api/                      # All server-side route handlers (see API Reference)
│   ├── components/
│   │   ├── header.tsx                # Public site header/nav
│   │   ├── proposal-form.tsx         # Multi-section proposal form (create + edit)
│   │   ├── registration-form.tsx     # Student registration form
│   │   └── ui/                       # shadcn/ui primitives (button, dialog, table, …)
│   ├── lib/
│   │   ├── constants.ts              # Tracks/clusters, required courses, types
│   │   ├── validations.ts            # Zod schemas for forms/APIs
│   │   ├── supabase.ts               # Server-side Supabase clients (anon + admin)
│   │   ├── supabase-browser.ts       # Client-side Supabase client (singleton)
│   │   ├── email.ts                  # Nodemailer wrapper + HTML email template
│   │   ├── csv.ts                    # CSV export helper for admin reports
│   │   └── utils.ts                  # `cn()` class-merging helper
│   ├── i18n/
│   │   ├── routing.ts                # Locale list + default locale
│   │   └── request.ts                # next-intl request config
│   ├── messages/
│   │   ├── he.json                   # Hebrew translation strings
│   │   └── en.json                   # English translation strings
│   ├── proxy.ts                      # next-intl middleware (locale routing)
│   └── instrumentation.ts            # Optional corporate-proxy dispatcher for Next.js
├── components.json                   # shadcn/ui config
├── next.config.ts                    # Next.js config (wraps next-intl plugin)
├── package.json
└── tsconfig.json
```

---

## Core Concepts

### Project Clusters ("Tracks")

Every project belongs to one of four clusters, each with its own block of
project numbers:

| Cluster ID | Label | Project numbers start at |
|---|---|---|
| `cyber` | Cyber Security | 101 |
| `networks` | Networks and Computation | 201 |
| `data` | Data Analysis and Processing | 301 |
| `hardware` | Hardware Design | 401 |

A project can also have a `recommended_track` — it's listed under its real
cluster but also surfaced to students browsing a second cluster. Numbers are
assigned automatically when a project is approved (next free number in that
cluster's range, scoped to the active academic year).

> Older data used different track IDs (`crypto`, `algorithms`, `software`,
> `ai`, `signal`). `normalizeTrack()` in `src/lib/constants.ts` maps these
> legacy values onto the four current clusters for backward compatibility.
> A one-time SQL migration (`20260616_replace_tracks_with_clusters.sql`)
> performs the same normalization directly in the database.

### Project Statuses

| Status | Meaning |
|---|---|
| `pending` | Newly submitted, awaiting staff review |
| `review` | Sent back to the supervisor with revision notes |
| `approved` | Published with a project number; visible to students |
| `rejected` | Rejected by staff; supervisor can still edit and resubmit |

### Registration Statuses

| Status | Meaning |
|---|---|
| `pending` | Student(s) registered; awaiting academic supervisor's decision |
| `approved` | Supervisor approved — the project becomes "taken" (`is_taken = true`) |
| `rejected` | Supervisor rejected — project remains available |

### Edit & Approval Tokens

- Every **project** has an `edit_token` (UUID). Supervisors use a link
  containing this token (`/he/propose?token=...`) to edit and resubmit a
  proposal — no login required. The token becomes invalid once the project
  is approved.
- Every **registration** has an `approval_token` (UUID), used in the email
  sent to the academic supervisor for one-click approve/reject
  (`/approve-registration/[token]`).

### Academic Years

All projects (and, transitively, all registrations) belong to an
**academic year** row. Exactly one year is "active" at a time. Public pages
always show data for the active year by default, but staff can switch the
viewed year via a `?year=<slug>` query parameter / the sidebar selector.
Archived (non-active) years are **read-only** in the public UI.

---

## Getting Started (Developers)

### Prerequisites

- **Node.js** ≥ 20.9 (required by Next.js 16)
- npm (or yarn/pnpm/bun — any will work, examples below use npm)
- A [Supabase](https://supabase.com) project (free tier is enough)
- A Gmail account with an **App Password**, if you want real emails sent
  (optional in development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the variables below into a `.env.local` file at the project root (see
[Environment Variables](#environment-variables) for full details).

### 3. Set up the database

Run the SQL in `supabase/schema.sql` once against a fresh Supabase project,
then apply any files in `supabase/migrations/` **in filename order** (they
are timestamp-prefixed). See [Database Setup](#database-setup).

### 4. (Optional) Seed demo data

```bash
node scripts/seed.mjs
```

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected
to `/he` (Hebrew is the default locale).

---

## Environment Variables

Create a `.env.local` file with the following:

```bash
# ── Supabase ────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key      # server-only, NEVER expose to client

# ── App URL (used to build links inside emails) ─────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000             # change to your production URL when deployed

# ── Email (optional — emails are skipped if these are unset) ───────────────
GMAIL_USER=your-sending-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password     # NOT your normal Gmail password
EMAIL_FROM_NAME=CE Final Projects                     # display name on outgoing emails

# ── Optional: bypass admin login during local development ──────────────────
NEXT_PUBLIC_DEV_ADMIN=true                            # skips Supabase auth for /admin/*

# ── Optional: link to a custom regulations PDF instead of the bundled one ───
NEXT_PUBLIC_PROJECT_REGULATIONS_URL=https://example.com/regulations.pdf

# ── Optional: corporate proxy for outbound requests (rarely needed) ────────
HTTPS_PROXY=http://proxy.example.com:8080
```

**Notes:**

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security and is used only
  in server-side API routes (`getAdminClient()` in `src/lib/supabase.ts`).
  Never expose it to the browser or commit it to source control.
- If `GMAIL_USER` / `GMAIL_APP_PASSWORD` are missing (or
  `GMAIL_APP_PASSWORD=skip`), `sendEmail()` silently logs and no-ops instead
  of throwing — useful for local development without a real mailbox.
- `NEXT_PUBLIC_DEV_ADMIN=true` is a **development-only convenience**. It
  fakes a logged-in admin session (`dev@local`) so you can access `/admin`
  without configuring Supabase Auth or magic links. **Never enable this in
  production.**

To generate a Gmail App Password: enable 2-Step Verification on the Google
account, then create an App Password under
*Google Account → Security → App passwords*.

---

## Database Setup

1. Create a new Supabase project.
2. Open the **SQL Editor** in the Supabase dashboard.
3. Paste and run the entire contents of `supabase/schema.sql`. This creates:
   - `projects`, `registrations`, `staff_emails`, `academic_years` tables
   - Indexes for common lookups (status, track, tokens)
   - An `updated_at` auto-update trigger on `projects`
   - Row Level Security (RLS) policies (public read of approved projects,
     public insert for proposal/registration submissions, token-based
     read/update)
   - A unique partial index ensuring only **one** academic year can be
     `is_active = TRUE` at a time
   - Seeds one initial academic year (`2526` / "תשפ"ו") and back-fills it
     onto any pre-existing projects
4. Run each file in `supabase/migrations/` **in chronological order** (the
   filenames are date-prefixed):
   - `20260616_replace_tracks_with_clusters.sql` — normalizes legacy track
     values into the 4 current clusters and renumbers projects accordingly.
     **Only needed if you have pre-existing data with old track names.**
   - `20260622_add_relevant_required_courses.sql` — adds the
     `relevant_required_course_1` / `_2` columns used by the proposal form.

5. Add at least one row to `staff_emails` so someone can log into `/admin`:

```sql
insert into staff_emails (email, name) values ('you@example.com', 'Your Name');
```

(The seed script in step "Seeding Demo Data" below does this automatically
for `yonatank50@gmail.com` — change that email before relying on it, or just
insert your own row manually as shown above.)

### Authentication

Admin login uses Supabase's **email OTP / magic link** flow
(`signInWithOtp`). Any email present in `staff_emails` can request a login
link or a 6-digit code; everyone else is rejected. There is no password —
access is purely allow-listed by email address.

---

## Seeding Demo Data

`scripts/seed.mjs` is a standalone Node script (uses `@supabase/supabase-js`
directly, not the Next.js app) that:

1. Upserts a staff email (`yonatank50@gmail.com` in the current script —
   **edit this before running** if you don't control that inbox, since all
   demo emails are routed there for testing).
2. **Deletes all existing `registrations` and `projects`** — ⚠️ this is
   destructive, intended for a fresh demo/staging database only.
3. Inserts 7 example projects (one per status: 2 pending, 1 in review, 3
   approved, 1 rejected) covering all four clusters, with full Hebrew
   content.
4. Inserts a couple of demo registrations (one approved pair, one pending
   single student) on two of the approved projects.

Run it with:

```bash
node scripts/seed.mjs
```

It requires an **active academic year** to already exist (the base schema
creates one). If none is active, the script aborts with a clear error
message and a hint to create one first in `/admin/settings`.

> `scripts/projects.json` is a static, English-language reference dataset
> (not wired into any script) — useful as a content reference/export
> format if you want to write your own seeding tool.

---

## Running the App

```bash
npm run dev      # start the dev server (with Fast Refresh)
npm run build    # production build
npm run start    # run the production build (after `build`)
npm run lint      # run ESLint
```

The app redirects `/` → `/he` (Hebrew). Switch language with the toggle in
the header, which swaps the `/he/...` ↔ `/en/...` URL prefix while keeping
the rest of the path.

---

## User Guide

### For Faculty: Submitting a Project Proposal

1. Go to **"Submit Project Proposal"** (`/he/propose` or `/en/propose`).
2. Fill in all four sections:
   - **Project Details** — Hebrew + English titles, cluster, and an
     optional secondary "recommended cluster."
   - **Supervisor Information** — the project supervisor's name/email and
     the *academic* supervisor's name/email (must be Engineering Faculty;
     this is the person who will later approve/reject student
     registrations by email).
   - **Academic Content** — abstract, objective (with expected
     deliverables), and scope (ordered task breakdown).
   - **Prerequisites & References** — up to two relevant *required* courses
     (picked from a fixed list), up to two *prerequisite* courses (free
     text), and a bibliography/reference list.
3. Submit. You'll see a success screen, and:
   - Course staff get an email notification with a link to the admin
     dashboard.
   - You and the academic supervisor get a confirmation email containing an
     **edit link** — you can revise and resubmit the proposal at any time
     **until it's finally approved**.
4. Your browser auto-saves an in-progress draft to `localStorage` (cleared
   on successful submission) so a refresh doesn't lose your work — this
   only applies to brand-new submissions, not edits via a token link.

If staff sends the proposal back with notes, you'll receive an email with
the notes and the same edit link — fix the issues and resubmit; the status
returns to "pending" for re-review.

If staff rejects the proposal, you'll also get an email (with any notes)
and the same edit link in case you want to substantially rework and
resubmit it as a new pending proposal.

### For Students: Registering for a Project

1. Go to **"Register for Project"** (`/he/register` or `/en/register`).
2. Choose an approved, currently-available project from the dropdown
   (only approved + not-yet-taken projects in the **active** academic year
   are listed).
3. Fill in Student 1's name, ID, and email (required). Optionally add
   Student 2 for pair projects.
4. Confirm that you're a Computer Engineering student (required checkbox).
5. Submit. You'll see a success screen. Behind the scenes:
   - The project's **academic supervisor** receives an email with the
     student details and **Approve / Reject** buttons.
   - Course staff are notified as well.
6. You'll receive an email once the supervisor makes a decision:
   - **Approved** → congratulations email, the project number is now
     officially yours.
   - **Rejected** → you can register for a different available project.

### For Academic Supervisors: Approving/Rejecting a Registration

You don't need an account. The registration email contains two buttons:

- **✓ Approval** → opens a confirmation page pre-filled with the decision,
  showing the project and student details — click the matching button again
  to finalize.
- **✕ Rejection** → same flow, for rejecting.

The link can only be used once; revisiting it after a decision has been made
shows "a decision has already been made for this request."

### Browsing Approved Projects

The **"Browse Projects"** page (`/projects`) lists every approved project
for the selected academic year, grouped into tabs by cluster (plus an "All
Clusters" tab). Each row/card expands to show the full abstract, objective,
scope, relevant/prerequisite courses, and references. Available projects
are shown normally; taken projects are visually flagged (red tint) and
labeled "Taken."

### Viewing Assigned Projects

The **"Assigned Projects"** page (`/assigned`) lists every project with an
**approved** registration for the selected year — project number, title,
supervisor, and the **last 4 digits** of each student's ID (for privacy;
full IDs are never shown publicly).

---

## Admin Guide

Admin pages live under `/admin/*` and are **not localized** (Hebrew-only
UI), separate from the public `/[locale]/*` tree, with their own layout,
auth gate, and sidebar navigation.

### Logging In

1. Go to `/admin`.
2. Enter your email (must exist in the `staff_emails` table).
3. You'll receive a magic link **and** a one-time code by email — either
   click the link or paste the code into the form.
4. On success you land on `/admin/pending`.

If `NEXT_PUBLIC_DEV_ADMIN=true` is set, this entire flow is skipped locally.

### Pending Proposals (`/admin/pending`)

Lists every project with status `pending` or `review` for the selected
academic year. Click a card to expand its full details, then:

- **✅ Approve** — assigns the next free project number for its cluster and
  publishes it; sends an approval email to the academic supervisor.
- **📝 Send Notes** — opens a dialog to write revision notes; sets status to
  `review` and emails the supervisor with the notes and an edit link.
- **✏️ Edit** — directly edit any field as staff (bypasses the supervisor's
  edit-token flow); useful for typo fixes or cluster corrections.
- **❌ Reject** — sets status to `rejected`; emails the supervisor (with any
  existing review notes) and an edit link in case they want to resubmit.
- **🗑️ Delete** — permanently removes the proposal (and cascades to any
  registrations on it).

### All Projects (`/admin/projects`)

Every project regardless of status, with search and cluster filtering. Full
inline edit dialog (title, cluster, status, project number, supervisor info,
content fields, "taken" flag, etc.) and delete. When viewing an **archived**
(non-active) year, each project also gets a **↗ Carry Over** action to copy
it into the currently active year (auto-assigns a fresh project number).

### Registrations (`/admin/registrations`)

Every student registration with search. Actions:

- **🔓 Free** (approved registrations only) — reverts status to `pending`
  and releases the project (`is_taken = false`) so it can be re-registered.
- **✏️ Edit** — change status or any student field directly.
- **🗑️ Delete** — removes the registration; if it was `approved`, the
  linked project is automatically freed.

### Reports (`/admin/reports`)

Generates CSV exports (opens cleanly in Excel) scoped to the selected
academic year:

- **All Projects** — every field for every project regardless of status.
- **Assigned Projects** — full project info joined with the approved
  registration's student details.
- **Status Summary** — per-cluster counts (total / pending / review /
  approved / rejected / occupied / available-and-approved).

### Settings — Academic Years (`/admin/settings`)

- **Create** a new academic year (slug, English label, Hebrew label).
- **Set as Active** — deactivates the current active year and activates the
  chosen one. Public-facing pages immediately start showing the new year's
  data.
- **Carry Over Projects** — bulk-copies all **approved + unassigned**
  projects from an archived year into the currently active year, with fresh
  auto-assigned project numbers.
- **Delete** a year — only allowed if it's not active and has zero linked
  projects.

### Switching the Viewed Year

Every admin page respects a shared "selected year" (stored in the URL as
`?year=<slug>` via `AdminYearProvider`/`useAdminYear`). Use the sidebar
dropdown to switch; it defaults to the active year on first load.

---

## Email Notifications

All outbound email goes through `sendEmail()` in `src/lib/email.ts` (Gmail
SMTP via Nodemailer) wrapped in `wrapEmailHtml()` for consistent RTL HTML
styling. If SMTP credentials are missing, sending is skipped and logged —
the app keeps working without crashing.

| Event | Recipients | Contains |
|---|---|---|
| New proposal submitted | Staff (`staff_emails`) | Project summary + admin dashboard link |
| New proposal submitted | Supervisor + academic supervisor | Confirmation + edit link |
| Proposal sent back for revision | Supervisor + academic supervisor (academic supervisor only, via `/api/projects/[id]/review`) | Revision notes + edit link |
| Proposal rejected | Academic supervisor | Rejection notice + edit link |
| Proposal approved | Academic supervisor | Assigned project number |
| Proposal edited & resubmitted | Staff + supervisor + academic supervisor | Confirmation + admin dashboard link |
| New student registration | Academic supervisor | Student details + Approve/Reject buttons |
| New student registration | Staff | Notification only |
| Registration approved | Both students | Confirmation with project number |
| Registration rejected | Both students | Rejection notice |

All recipient lists are deduplicated and validated against a basic email
regex before sending (`collectRecipients()` helpers in the relevant API
routes) so a malformed address never silently breaks a notification batch.

---

## Academic Years (Archiving)

- Exactly one academic year can be `is_active = true` at any time (enforced
  by a unique partial index at the database level, not just in app code).
- New proposals are always tagged with the **currently active** year at
  submission time.
- Student registration and the public projects/assigned pages only ever
  operate on the active year's data.
- Admin pages let staff browse **any** year (active or archived) via the
  year switcher; archived years are read-only on the public site (banner
  shown) but still fully editable from `/admin`.
- "Carry over" (both at the single-project and whole-year level) copies
  **approved, not-yet-taken** projects into the active year, assigning each
  a fresh project number in its cluster's range — it never touches projects
  that are pending/review/rejected/taken.

---

## API Reference

All routes are Next.js Route Handlers under `src/app/api/`. Admin-only
routes use the Supabase **service role** key server-side (`getAdminClient()`
in `src/lib/supabase.ts`) and have no additional auth middleware — they rely
on the admin UI's client-side auth gate, so **do not expose these routes
publicly without adding your own server-side authorization** if you deploy
this beyond a trusted internal environment.

### Public

| Method & Path | Purpose |
|---|---|
| `GET /api/academic-years` | List all academic years |
| `GET /api/projects` | List approved, unassigned projects in the active year (for the registration dropdown) |
| `POST /api/projects` | Submit a new proposal |
| `PUT /api/projects/[id]` | Edit & resubmit a proposal via `edit_token` |
| `POST /api/projects/[id]/approve` | Approve a proposal (staff action, no extra auth) |
| `POST /api/projects/[id]/reject` | Reject a proposal |
| `POST /api/projects/[id]/review` | Send a proposal back with revision notes |
| `POST /api/registrations` | Submit a student registration |
| `GET /api/registrations/[token]/info` | Fetch registration details by approval token |
| `POST /api/registrations/[token]/decide` | Approve/reject a registration by approval token |

### Admin (service-role; gate access at your infra/CDN layer if needed)

| Method & Path | Purpose |
|---|---|
| `GET /api/admin/academic-years` *(via `/api/academic-years`)* | — |
| `POST /api/admin/academic-years` | Create a new academic year |
| `PUT /api/admin/academic-years/[id]` | Set a year as active |
| `DELETE /api/admin/academic-years/[id]` | Delete a year (must be empty & inactive) |
| `POST /api/admin/academic-years/[id]/carry-over` | Bulk carry-over approved projects into the active year |
| `PUT /api/admin/projects/[id]` | Edit any project field |
| `DELETE /api/admin/projects/[id]` | Delete a project (cascades registrations) |
| `POST /api/admin/projects/[id]/carry-over` | Carry over a single project into the active year |
| `PUT /api/admin/registrations/[id]` | Edit a registration (handles `is_taken` side-effects on status change) |
| `DELETE /api/admin/registrations/[id]` | Delete a registration (frees the project if it was approved) |

---

## Internationalization

- Powered by **next-intl**; locales are `he` (default) and `en`, configured
  in `src/i18n/routing.ts`.
- `src/proxy.ts` is the Next.js middleware that handles locale-prefixed
  routing (matches `/`, `/(he|en)/*`, and bare paths, while excluding `api`,
  `_next`, `admin`, `auth`, and `approve-registration`, which are
  intentionally **not** localized).
- Translation strings live in `src/messages/he.json` and
  `src/messages/en.json` — keep both files structurally in sync when adding
  new UI text.
- Hebrew renders `dir="rtl"`; English renders `dir="ltr"` (set in
  `src/app/[locale]/layout.tsx`). The `/admin`, `/auth/callback`, and
  `/approve-registration` trees are hard-coded to Hebrew/RTL regardless of
  the visitor's locale, since they're staff/supervisor-facing only.

---

## Deployment

This is a standard Next.js app — the simplest path is
[Vercel](https://vercel.com/new):

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Import it into Vercel.
3. Add all variables from [Environment Variables](#environment-variables) in
   **Project Settings → Environment Variables** (do **not** set
   `NEXT_PUBLIC_DEV_ADMIN` in production).
4. Set `NEXT_PUBLIC_APP_URL` to your production domain — this value is baked
   into every email link, so it must be correct before going live.
5. Deploy.

If you need a custom "project regulations" PDF without rebuilding, set
`NEXT_PUBLIC_PROJECT_REGULATIONS_URL` to an external URL instead of
replacing `public/project-regulations.pdf`.

---

## Troubleshooting

**"חסרה הגדרת Supabase בסביבה המקומית" (Missing Supabase configuration)**
on the admin login screen
→ `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` aren't set.
Add them to `.env.local` and restart the dev server.

**Emails aren't arriving**
→ Check that `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set and that the
password is an **App Password**, not your regular Gmail password (requires
2-Step Verification enabled on the Google account). With nothing configured,
`sendEmail()` intentionally no-ops and just logs `[email] Skipped` — check
your server logs.

**"לא ניתן למחוק שנה עם N פרויקטים משויכים" when deleting an academic year**
→ You can only delete a year with zero linked projects. Either delete/move
those projects first, or just leave the year archived.

**A staff member can't log in**
→ Their email must exist (case-insensitively) in the `staff_emails` table.
Insert it via the Supabase SQL editor:
`insert into staff_emails (email, name) values ('them@example.com', 'Name');`

**Project numbers collide across academic years**
→ They shouldn't — numbering (`nextFreeNumber()`) is always scoped to a
single academic year's existing project numbers within that cluster, both
on approval and on carry-over.

**Track/cluster constraint errors when running `scripts/seed.mjs`**
→ Your database still has the old 7-track CHECK constraint. Run
`supabase/migrations/20260616_replace_tracks_with_clusters.sql` (the seed
script will also print the exact SQL needed if it detects this).
