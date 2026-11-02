# shoptaker — College Management (DBMS project)

**Complete DBMS reference:** [`project.md`](project.md) documents every table, attribute, key, constraint, relationship, normalization step, join/filter path, index, transaction, report and project code path.

database, are served by a REST API, and are managed through a Tailwind admin dashboard.
Nothing is mocked: every table cell, statistic, chart and report is a live SQL query,
and every form writes to the database.

This repository now contains **two runnable builds of the same system**:

| | `web/` — Next.js build | `backend/` + `frontend/` — original build |
| --- | --- | --- |
|run| `cd web && npm install && npm run dev` → <http://localhost:3000> | docker compose + uvicorn + Vite (see below) |
|Database| SQLite (node:sqlite) local file, seeded automatically on first start | PostgreSQL 16 (schema + seed in `database/`) |
|Frontend| React (ported into Next.js), same Tailwind components | React + Vite |
|Theme| mail.st-style charcoal / #83D63B accent | original indigo SaaS theme |

Both expose the same 9-table 3NF schema, same REST contract
(`/api/students`, `/api/departments`, ...), same dashboard, reports and CSV export,
same capacity-enforced enrollment.

> **Reference follow-up (later turn):** the PostgreSQL/FastAPI edition in `backend/`
> plus `frontend/` is left running as originally demonstrated so you can compare it
> directly with the Next build.

---

## Quick start (from the repository root)

```bash
cd /home/bhanu/code/shoptaker
npm install       # first time only; installs the web workspace dependencies
npm run dev       # starts Next.js at http://localhost:3000
```

Stop the server with **Ctrl+C**. To run the PostgreSQL/FastAPI/Vite edition instead,
follow section 2 below. `npm run dev` at the repository root starts the Next.js build;
no need to `cd web` first.


```bash
cd web
npm install
npm run dev        # http://localhost:3000  (database: web/lib/.data/campus.sqlite)
```

- The SQLite file is created, migrated and deterministically seeded on first start.
  Delete `web/lib/.data/` to reset everything.
- Production: `npm run build && npm start`
- API: <http://localhost:3000/api/health>, reports catalogue at `/api/reports`
- **Learn page:** <http://localhost:3000/learnit> serves every handover study file
  (topics list, ER diagram images, normalization write-ups) straight from this
  repository's `learnit/` folder — no copying.

Stack: Next.js 15, React 19, Tailwind CSS, Recharts, Lucide, Axios, React Hook Form,
SQLite (`node:sqlite`, no native install required).

Full architecture, design decisions and a SQLite-vs-PostgreSQL comparison:
[`web/lib/README.md`](web/lib/README.md) and [`learnit/README.md`](learnit/README.md).

Tests:

```bash
cd web && npm test          # 7 suites: seed counts, CRUD on all 9 tables, constraints,
                            # capacity/concurrency, envelopes, reports/CSV, workspace guards
node scripts/ui-smoke.mjs   # 24 real-Chromium checks over the running app
```

---

## 2. Run the original PostgreSQL + FastAPI + Vite build

```bash
docker compose up -d                                  # PostgreSQL 16 (localhost:5432)
psql -h localhost -U postgres -d college -f database/schema.sql
psql -h localhost -U postgres -d college -f database/seed.sql

cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload                         # http://localhost:8000/api

cd frontend && npm install && npm run dev             # http://localhost:5173
```

Also in this edition:

- `cd backend && .venv/bin/python -m pytest -q` — 83 pytest tests (own `college_test` DB)
- `python scripts/verify_database.py` — schema/constraint verification
- `cd frontend && node scripts/ui-smoke.mjs` — browser-level checks
- `psql -d college -f database/queries.sql` — 15 SQL demonstrations
- Swagger UI at <http://localhost:8000/docs>; full API reference in
  [`docs/API_Documentation.md`](docs/API_Documentation.md)

---

## 3. Features (both builds)

- **Full CRUD** for students, faculty, departments, courses, semesters, offerings,
  assignments, enrollments, grades — with search, filters, sorting, pagination and
  joined detail pages (transcripts, assigned faculty, rosters).
- **Dashboard** — six live statistic cards, four aggregate charts, recent activity.
- **Reports** — nine report tables across three tabs plus CSV export.
- **Capacity enforcement in the database itself** — a write transaction / row lock plus
  trigger makes enrollment safe under concurrency (proven by a parallel-writer test).
- **Referential integrity with ON DELETE RESTRICT** — academic history is never erased
  silently; deletes return readable 409s ("…10 student(s) depend on it").
- **Readable validation errors** mapped from database constraint codes to plain English.
- No mock data, no fake login/logout: the UI is explicitly labelled a *local
  administrative demo*.

Data is 3NF/BCNF throughout; derived values (seat utilisation, enrolled counts) are
computed by SQL, never stored.

Seed data: 5 departments · 50 students · 15 faculty · 20 courses · 4 semesters ·
30 offerings · 20 assignments · 100 enrollments · 60 grades.

---

## 4. Study pack — `learnit/`

Built for handover; also browsable at `/learnit` on the Next build.

| File | Purpose |
| --- | --- |
| `learnit/topics.md` | **Topics only** — every DBMS-syllabus topic the project exercises |
| `learnit/ER_Diagram.{mmd,md,png,svg}` | Complete ER diagram of the database |
| `learnit/ER_Explanation_Normalization.md` | Concept-by-concept: what we used, why, and why not the common alternative |
| `learnit/Architecture.md` | Request → route → database → response walkthrough, normalization record by record |
| `learnit/Viva.md` | Short Q&A (colleges ask these) |
| `learnit/README.md` | Map of the pack, honest stack notes |

> **Note:** the reference images could not be viewed from the working session, so the
> topic pack is organised around the topics the project's reports cover and is labelled
> accordingly in `learnit/README.md`.

---

## 5. Original-build documentation

| Doc | Contents |
| --- | --- |
| `docs/ER_Diagram.*` | ER diagram (Mermaid source + rendered PNG) |
| `docs/ER_Explanation.md` | Relationships, cardinality, participation |
| `docs/Normalization.md` | Worked 1NF → 3NF on a messy registration sheet |
| `docs/Database_Constraints.md` | Every constraint annotated |
| `docs/API_Documentation.md` | Endpoint reference |
| `docs/Project_Report.md` | Project report |
| `database/` | `schema.sql`, `seed.sql` (rerunnable), `queries.sql`, `normalization.sql` |

---

## 6. Known limitations

- Auth is out of scope in both builds by design.
- The Next build's SQLite file is a single-node local database — perfect for demos,
  not for multi-user production; the PostgreSQL build exists to show the server-grade
  path.
- UI smoke tests need a local Chromium binary.
- Next server caching makes a rebuild (`npm run build`) a requirement between edits and
  `npm start`.

---

## 7. Verification summary

| Check | Result |
| --- | --- |
| `web` API tests (`npm test`) | 7/7 suites pass (seed counts, CRUD on all nine tables, every constraint class, capacity concurrency, envelopes, reports + CSV) |
| `web` UI smoke (Chromium) | 24/24 checks pass — dashboard, search/filter/sort, create/edit/delete, duplicate email, delete protection, grade form, reports + CSV, theme toggle, sidebar collapse |
| `web` production build | `npm run build` succeeds |
| `backend` pytest | 83/83 pass against a dedicated `college_test` database |
| `scripts/verify_database.py` | All schema/constraint/trigger/view checks pass |
| `frontend` + `web` browsers | Both dev servers served the live UI in Chromium with no console errors |

Notes: the smoke script (`web/scripts/ui-smoke.mjs`) drives the running server on port
3000 and clears its `web/lib/.data` directory at the start; the dark theme toggle is
verified live by that script.
