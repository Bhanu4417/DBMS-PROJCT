# CampusOS — Complete DBMS Project Reference

> **Purpose:** one detailed reference for viva, review and project handover. It documents the data model, all tables/columns/keys/constraints, relationships, normalization, SQL usage, application flow, transactions, indexes, reports, test setup and the two implementations.
>
> **Two distinct running builds:** (1) `web/`: Next.js + Node.js `node:sqlite` + local SQLite file; (2) `frontend/` + `backend/`: React/Vite + FastAPI/SQLAlchemy + PostgreSQL. They share the academic model and feature set, but do not share a running database connection. Always state which build you mean.

## 1. Project at a glance

CampusOS is a local college administration demo. It manages departments, students, faculty, courses, semesters, course offerings, faculty assignments, enrollments and grades. Screens support list/read/create/update/delete, search, filters, sorting, pagination and record details. The dashboard and reports summarize database records; CSV export is available. Authentication is intentionally out of scope.

### Implementations and connection paths

| Build | UI | Server/API | Database and connection |
|---|---|---|---|
| Next.js | React + Next.js App Router, `web/src/` | App Router API handler `web/app/api/[...path]/route.js`, dispatch/service in `web/lib/api.mjs` | Built-in Node `node:sqlite`, `DatabaseSync`, file `web/lib/.data/campus.sqlite`; initialized and seeded on first creation |
| PostgreSQL | React + Vite, `frontend/src/` | FastAPI routers, SQLAlchemy services in `backend/app/` | SQLAlchemy engine configured by `DATABASE_URL`, PostgreSQL schema in `database/schema.sql` |

The browser never opens a direct SQL connection: it sends HTTP requests to its server. The server validates the request, queries/updates the DB and returns JSON or CSV. In FastAPI, `backend/app/database.py` creates an engine/session and `get_db()` yields a request-scoped session. In Next.js, the Node API route calls `dispatch()`, which accesses SQLite.

**Quick start:** from the project root: `npm install`, then `npm run dev`; Next.js is at `http://localhost:3000`. For the original stack follow root `README.md`, start PostgreSQL, FastAPI and Vite.

## 2. Relational model / ER overview

```text
DEPARTMENT 1 ─── 0..N STUDENT            (student department optional)
DEPARTMENT 1 ─── 0..N FACULTY            (faculty department required)
DEPARTMENT 1 ─── 0..N COURSE             (course department required)
COURSE     1 ─── 0..N COURSE_OFFERING    (offering requires course)
SEMESTER   1 ─── 0..N COURSE_OFFERING    (offering requires semester)
FACULTY    1 ─── 0..N FACULTY_ASSIGNMENT ─── 1 COURSE_OFFERING
STUDENT    1 ─── 0..N ENROLLMENT         ─── 1 COURSE_OFFERING
ENROLLMENT 1 ─── 0..1 GRADE
```

`FACULTY_ASSIGNMENT` resolves faculty↔offering M:N. `ENROLLMENT` resolves student↔offering M:N. A course offering is a course in a semester and section. A department/semester/course may exist with zero children: mandatory child-side FK does not force the parent to have children. Student's department FK is nullable. See [`learnit/ER_Diagram.png`](learnit/ER_Diagram.png), Mermaid source [`learnit/ER_Diagram.mmd`](learnit/ER_Diagram.mmd), and [`learnit/ER_Diagram.md`](learnit/ER_Diagram.md).

## 3. All nine tables and attributes

Types below describe the PostgreSQL implementation unless “SQLite” is stated. `PK` primary key; `FK` foreign key; `UK` unique/candidate key. Attributes not marked nullable are `NOT NULL`. `?` means nullable. Defaults are generated if omitted.

### 3.1 `department` — academic unit

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `department_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `department_code` | VARCHAR(10) | UK, required; uppercase 2–10 letters | Short code such as CSE |
| `department_name` | VARCHAR(100) | UK, required | Display name |
| `office_location` | VARCHAR(100) | nullable | Office location |
| `created_at` | TIMESTAMP | required, default `CURRENT_TIMESTAMP` | Creation time |

**Candidate keys:** `department_id`, `department_code`, `department_name`.

### 3.2 `student` — student identity and admission information

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `student_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `enrollment_number` | VARCHAR(30) | UK, required | Institutional student identifier |
| `first_name` | VARCHAR(50) | required | First name |
| `last_name` | VARCHAR(50) | required | Last name |
| `email` | VARCHAR(150) | UK, required; email-format check | Contact / unique address |
| `phone` | VARCHAR(15) | nullable; format check if present | Contact number |
| `date_of_birth` | DATE | nullable | Birth date |
| `gender` | VARCHAR(20) | nullable; allowed-value check | Optional demographic field |
| `admission_year` | INTEGER | required; 2000–2100 | Admission year |
| `department_id` | INTEGER | nullable FK → `department.department_id` | Optional department |
| `status` | VARCHAR(20) | required, default `Active`; Active/Graduated/Inactive | Student status |
| `created_at` | TIMESTAMP | required, default `CURRENT_TIMESTAMP` | Creation time |

**Candidate keys:** `student_id`, `enrollment_number`, `email`.

### 3.3 `faculty` — teaching staff

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `faculty_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `employee_code` | VARCHAR(30) | UK, required | Institutional staff identifier |
| `first_name` | VARCHAR(50) | required | First name |
| `last_name` | VARCHAR(50) | required | Last name |
| `email` | VARCHAR(150) | UK, required; email-format check | Unique contact address |
| `phone` | VARCHAR(15) | nullable; format check if present | Contact number |
| `designation` | VARCHAR(100) | nullable | Role/title |
| `joining_date` | DATE | nullable; if present >= 1950-01-01 | Employment date |
| `department_id` | INTEGER | required FK → `department.department_id` | Faculty department |
| `created_at` | TIMESTAMP | required, default `CURRENT_TIMESTAMP` | Creation time |

**Candidate keys:** `faculty_id`, `employee_code`, `email`.

### 3.4 `course` — course catalogue

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `course_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `course_code` | VARCHAR(20) | UK, required; code-format check | Catalogue code, e.g. CSE-301 |
| `course_name` | VARCHAR(150) | required | Course title |
| `credits` | INTEGER | required; 1–6 | Credit value |
| `department_id` | INTEGER | required FK → `department.department_id` | Owning department |
| `description` | TEXT | nullable | Short description |

**Candidate keys:** `course_id`, `course_code`.

### 3.5 `semester` — academic term

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `semester_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `semester_name` | VARCHAR(50) | required; part of composite UK | E.g. Odd Semester |
| `academic_year` | VARCHAR(9) | required; part of composite UK; YYYY-YYYY | Academic-year label |
| `start_date` | DATE | required | Start date |
| `end_date` | DATE | required; after start date | End date |
| `status` | VARCHAR(20) | required, default `Upcoming`; Upcoming/Active/Completed | Term lifecycle |

**Candidate keys:** `semester_id`, (`semester_name`, `academic_year`). Neither composite-key component is unique by itself.

### 3.6 `course_offering` — a course taught in a semester section

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `offering_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Stable internal ID |
| `course_id` | INTEGER | required FK → `course.course_id`; composite UK part | Course being taught |
| `semester_id` | INTEGER | required FK → `semester.semester_id`; composite UK part | Term |
| `section` | VARCHAR(20) | required; composite UK part | Section identifier |
| `capacity` | INTEGER | required; > 0 | Maximum non-dropped registrations |
| `created_at` | TIMESTAMP | required, default `CURRENT_TIMESTAMP` | Creation time |

**Candidate keys:** `offering_id`, (`course_id`, `semester_id`, `section`). The three composite components are not individually unique.

### 3.7 `faculty_assignment` — faculty↔offering association

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `assignment_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Assignment row ID |
| `faculty_id` | INTEGER | required FK → `faculty.faculty_id`; composite UK part | Assigned faculty |
| `offering_id` | INTEGER | required FK → `course_offering.offering_id`; composite UK part | Assigned offering |
| `assigned_at` | TIMESTAMP | required, default `CURRENT_TIMESTAMP` | Assignment time |

**Candidate keys:** `assignment_id`, (`faculty_id`, `offering_id`). Allows team teaching but prevents the same faculty being assigned twice to one offering.

### 3.8 `enrollment` — student↔offering association / registration

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `enrollment_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Registration row ID |
| `student_id` | INTEGER | required FK → `student.student_id`; composite UK part | Registered student |
| `offering_id` | INTEGER | required FK → `course_offering.offering_id`; composite UK part | Selected course section |
| `enrollment_date` | DATE | required, default `CURRENT_DATE` | Registration date |
| `enrollment_status` | VARCHAR(20) | required, default `Enrolled`; Enrolled/Completed/Dropped | Registration lifecycle |

**Candidate keys:** `enrollment_id`, (`student_id`, `offering_id`). A student can take the same course in another semester/section because that is a different offering. Re-enrollment into the identical offering is blocked by the UK.

### 3.9 `grade` — grade for a registration

| Attribute | Type | Key / nullability / rule | Purpose |
|---|---|---|---|
| `grade_id` | SERIAL / SQLite INTEGER AUTOINCREMENT | PK, required | Grade row ID |
| `enrollment_id` | INTEGER | required, UNIQUE FK → `enrollment.enrollment_id` | At most one grade for each enrollment |
| `marks_obtained` | NUMERIC(5,2) PostgreSQL / REAL SQLite | nullable; >= 0 and <= max | Awarded marks |
| `max_marks` | NUMERIC(5,2) PostgreSQL / REAL SQLite | required, > 0; API default 100 | Assessment maximum |
| `grade_letter` | VARCHAR(2) | nullable; A+, A, B+, B, C, D, F | Independently recorded letter grade |
| `updated_at` | TIMESTAMP | required, default now; updated by trigger on PostgreSQL | Last update time |

**Candidate keys:** `grade_id`, `enrollment_id`. UNIQUE + NOT NULL on the FK gives Enrollment → Grade 0..1 and Grade → Enrollment exactly 1.

## 4. Primary keys, alternate keys and referential integrity

All nine relations have one surrogate PK (`*_id`). Surrogate IDs provide compact, stable FK references; they do **not** replace business uniqueness. Alternate candidate keys are:

| Relation | Alternate candidate key(s) |
|---|---|
| department | department_code; department_name |
| student | enrollment_number; email |
| faculty | employee_code; email |
| course | course_code |
| semester | (semester_name, academic_year) |
| course_offering | (course_id, semester_id, section) |
| faculty_assignment | (faculty_id, offering_id) |
| enrollment | (student_id, offering_id) |
| grade | enrollment_id |

There are 10 FKs. Each uses `ON DELETE RESTRICT` and `ON UPDATE CASCADE`: student→department (nullable FK), faculty→department, course→department, offering→course, offering→semester, assignment→faculty, assignment→offering, enrollment→student, enrollment→offering, grade→enrollment. RESTRICT protects academic history. Archive through status (`Inactive`/`Dropped`) instead of silently deleting history.

## 5. Constraints and business rules

- **PK:** one identity per row; every table has one.
- **FK:** referenced parent row must exist; SQLite connections explicitly enable `PRAGMA foreign_keys=ON`.
- **UNIQUE:** 12 alternate/composite uniqueness rules listed above.
- **NOT NULL:** every required attribute in the tables above; optional demographics, department assignment for a student, descriptions, and grade facts remain nullable where appropriate.
- **CHECK:** department/course code formats; email and phone formats; admission year 2000–2100; allowed student/gender/faculty/semester/enrollment/grade values; credits 1–6; semester year format and end after start; capacity positive; marks nonnegative/not over maximum; maximum marks positive; plausible faculty joining date.
- **Defaults:** statuses, timestamps, enrollment date, grade max (API defaults max_marks to 100).
- **Business triggers:** reject an enrollment that would exceed offering capacity; reject capacity reduction below active registrations; touch grade timestamp when changed. In PostgreSQL capacity is serialized by row lock (`SELECT ... FOR UPDATE`) and a DB trigger; in SQLite `BEGIN IMMEDIATE` serializes writes and SQLite triggers enforce capacity/reduction.
- **Delete policy:** restrictive FK rules protect history; API translates dependency violations to readable conflicts (HTTP 409).

## 6. Normalization: why the model is 3NF

Start with a flat registration spreadsheet containing student, department, course, semester, section, marks and a list of teachers.

### 1NF — atomic values

A comma-separated `faculty_names` list is a repeating group, not atomic. Store faculty assignments as rows in `faculty_assignment`; store each student's registration as a row in `enrollment`. Every cell holds a single value.

### 2NF — no partial dependency on a composite key

In a flat registration, the natural registration key is student plus offering. The offering is identified by course, semester and section; using only course or only student omits part of that key. Student's name depends on student, course name/credits depend on course, offering capacity depends on offering; these facts belong in their respective entity relations, not on a registration row. The M:N association rows use unique pairs.

### 3NF — no transitive dependency

A student's department name is determined by department, not by student itself. Store `department_name` once in `department`, keep `department_id` as the student's FK. Similarly, course facts live in `course`; semester facts in `semester`; grades in `grade`. This avoids update/insert/delete anomalies and duplicate strings.

### Candidate keys and functional dependencies (examples)

- `student_id →` all student attributes; `enrollment_number →` student attributes; `email →` student attributes.
- `course_id →` course attributes; `course_code →` course attributes.
- `semester_id →` semester attributes; (`semester_name`, `academic_year`) → semester attributes.
- `offering_id →` offering attributes; (`course_id`, `semester_id`, `section`) → offering attributes.
- `enrollment_id →` enrollment attributes; (`student_id`, `offering_id`) → enrollment attributes.
- `grade_id →` grade attributes; `enrollment_id →` grade attributes due UNIQUE.
- Similar PK and composite-UK dependencies hold for department and association tables.

Derived values (counts, seats available, utilization, percentages) are calculated in queries, not stored redundantly. `grade_letter` is independent input and is **not** asserted to be calculated from marks. Full worked normalization: [`learnit/Normalization.md`](learnit/Normalization.md), executable demonstration: [`database/normalization.sql`](database/normalization.sql).

## 7. Joins: how useful records are reconstructed

Normalized tables store facts once; a JOIN combines them by matching FK to PK. Example (PostgreSQL):

```sql
SELECT s.enrollment_number, s.first_name, s.last_name, d.department_name
FROM student AS s
LEFT JOIN department AS d ON d.department_id = s.department_id;
```

`INNER JOIN` returns only matched pairs. `LEFT JOIN` retains every row from the left even when no right-side match exists (e.g. a student without a department, or enrollment without a grade).

| User-facing result | Join path |
|---|---|
| Student list with department | student LEFT JOIN department |
| Faculty list | faculty JOIN department |
| Course catalogue | course JOIN department |
| Course offerings | course_offering JOIN course JOIN semester; assignment/faculty for names |
| Faculty assignments | faculty_assignment JOIN faculty JOIN department JOIN offering JOIN course JOIN semester |
| Enrollment/transcript | enrollment JOIN student LEFT JOIN department JOIN offering JOIN course JOIN semester LEFT JOIN grade |
| Grade report | grade JOIN enrollment JOIN student JOIN offering JOIN course JOIN semester |

Reusable PostgreSQL SQLAlchemy statements: `backend/app/services/queries.py`; SQLite query strings: `web/lib/queries.mjs`. PostgreSQL also defines views `v_enrollment_details`, `v_offering_utilization`, `v_student_academic_summary` in `database/schema.sql`. Those are PostgreSQL views; SQLite uses code-defined query strings instead.

## 8. Searching, filtering, sorting, pagination

The UI's shared generic page is `frontend/src/components/ResourcePage.jsx` (Next copy `web/src/components/ResourcePage.jsx`). Screen metadata (columns, filters, form fields and endpoint) is in `frontend/src/config/resources.js` and `web/src/config/resources.js`. Search is debounced so each keystroke does not immediately generate a request.

### PostgreSQL/FastAPI behavior

`GET /api/students?search=maya&department_id=2&status=Active&sort_by=name&sort_dir=asc&page=1&page_size=10` reaches `backend/app/routers/students.py`. The router builds SQLAlchemy `SELECT`, adds `WHERE` conditions (name/email/enrollment-number search, department, status, year), uses an allow-listed sort column, then SQL `LIMIT`/`OFFSET` pagination in `backend/app/utils/pagination.py`. PostgreSQL does filtering, sorting and pagination before returning the rows. Case-insensitive text search uses `ILIKE`.

### Next.js/SQLite behavior (important implementation distinction)

`web/lib/api.mjs` currently loads a resource's joined rows using prepared SQL, then its `filtered()` function filters, sorts and paginates those rows in Node.js. Therefore search/filter is **not SQL WHERE for list endpoints in the Next.js implementation**. SQLite still runs joined SQL queries, validates and stores changes, enforces FKs and executes triggers. This current in-memory list filtering is simple for the seeded demo but is less scalable than PostgreSQL's database-side filtering.

`WHERE` selects matching rows; `ORDER BY` establishes display order; `LIMIT`/`OFFSET` return one page. Sorting fields are allow-listed in FastAPI and validated against query result columns in SQLite service code; user input is not interpolated as an arbitrary SQL identifier.

## 9. Dashboard and reports: DBMS operations used

- **Statistic cards:** `COUNT(*)` by relation; counts active enrollments and active semesters with `WHERE`.
- **Students by department:** department LEFT JOIN student, `COUNT`, `GROUP BY` department.
- **Admissions by year:** `GROUP BY admission_year`, `COUNT`.
- **Enrollment distribution:** `GROUP BY enrollment_status`, `COUNT`.
- **Offerings by semester:** semester LEFT JOIN offering, `GROUP BY` semester.
- **Capacity utilization:** count enrollments excluding `Dropped`; `enrolled / capacity * 100`.
- **Faculty/course/assignment details:** multi-table joins to recover labels.
- **Grade report:** joins grade, enrollment, student, offering, course and semester; computes percentage from marks / max marks.
- **Semester summary:** `COUNT(DISTINCT offering_id)`, enrollments and `COUNT(DISTINCT student_id)`.
- **CSV export:** report query selects defined columns and serializes rows with CSV escaping. The SQLite export also neutralizes spreadsheet formula prefixes.

Code: `backend/app/services/dashboard.py`, `backend/app/services/reports.py`, `backend/app/utils/pagination.py`; Next code: `web/lib/api.mjs`, `web/lib/reports.mjs`.

## 10. SQL syllabus concept map and demonstrations

| DBMS/SQL idea | How this project uses it |
|---|---|
| Database/schema/instance | `database/schema.sql` or `web/lib/schema.mjs` defines schema; seeded/live rows are an instance |
| Relational model | Nine relations (tables), attributes (columns), tuples (rows), domains (valid values/types) |
| Three-schema architecture | UI/screens are external views; nine-relational model is conceptual; DB files/indexes/WAL are physical/internal |
| DDL | `CREATE TABLE`, `CREATE INDEX`, PK/FK/UNIQUE/CHECK in the schemas |
| DML | `SELECT`, `INSERT`, `UPDATE`, `DELETE` for CRUD; prepared/bound values |
| Keys | PKs, alternate candidate/unique keys, composite keys and FKs |
| Entity integrity | PK required and unique |
| Referential integrity | FKs, `ON DELETE RESTRICT`, `ON UPDATE CASCADE` |
| Domain integrity | NOT NULL, DEFAULT, CHECK, validation |
| Selection | `WHERE` filtering |
| Projection | SELECT list chooses columns |
| Joins | inner/left and multi-table joins for list, detail and reports |
| Grouping/aggregates | `GROUP BY`, `COUNT`, `AVG`, `MIN`, `MAX`, `SUM` |
| HAVING | Filters grouped results, e.g. offerings with at least N registrations |
| ORDER BY | Sorting report and list results |
| Subqueries | `IN`, correlated scalar counts, `EXISTS`/`NOT EXISTS` |
| Views | Three reusable PostgreSQL views |
| Indexes | Lookup/filter/join indexes in PostgreSQL schema |
| Transactions / ACID | Mutations grouped into commit or rollback; consistency enforced by checks/triggers |
| Concurrency | PostgreSQL row lock; SQLite immediate write transaction and busy timeout |
| Normalization | 1NF, 2NF, 3NF decomposition; association tables for M:N |
| Window function | Bonus `rank() OVER (PARTITION BY ... ORDER BY ...)` query |
| CSV | Query result serialization for report export |

Runnable PostgreSQL examples (selection, INNER/LEFT JOIN, grouping, HAVING, ordering, aggregates, nested subqueries, transcript join, CRUD inside rollback, views, EXPLAIN/index, window function): [`database/queries.sql`](database/queries.sql). Run against the PostgreSQL database after schema and seed. This is a Postgres-specific `psql` script.

## 11. Indexes and views (PostgreSQL schema)

13 explicitly declared indexes support frequently filtered/joined columns: student department/status/admission/name; faculty department; course department; offering semester/course; assignment offering; enrollment offering/student/status; grade letter. PK and UNIQUE constraints create additional supporting indexes. Indexes accelerate reads at the cost of storage and some write work.

Three views: `v_enrollment_details` (transcript join), `v_offering_utilization` (capacity and utilization), `v_student_academic_summary` (student course/credit/percentage summary). These are installed in PostgreSQL only; they are not tables and do not store independent copies of the underlying rows.

## 12. Transactions and capacity protection

A transaction is a set of DB actions committed together or rolled back on error (atomicity). Constraints/triggers maintain validity (consistency); DB locking controls conflicting writes (isolation); committed data is persisted according to the DB's durability guarantees.

- **PostgreSQL:** `backend/app/services/enrollments.py` checks the student, locks the offering row with `SELECT ... FOR UPDATE`, checks duplicates and active enrollment count, then inserts and commits. Trigger `trg_enrollment_capacity` repeats the check for direct SQL clients. Two parallel requests for the final seat cannot both pass the lock/check/insert sequence.
- **SQLite:** `web/lib/api.mjs` wraps mutations in `BEGIN IMMEDIATE ... COMMIT`, rolls back on errors, and configures foreign keys/WAL/busy timeout. Triggers `capacity_insert`, `capacity_update`, and `capacity_reduce` enforce limits.
- Dropped registrations do not consume a seat. An offering capacity cannot be lowered beneath its current non-dropped registrations.

These are DB-specific implementations of the same business rule, not interchangeable SQL syntax.

## 13. API surface

Both builds have equivalent resource families under `/api`:

- `/students`, `/faculty`, `/departments`, `/courses`, `/semesters`, `/offerings`, `/assignments`, `/enrollments`, `/grades`
- Resource lists: GET; creation: POST; detail: GET `/{id}`; update: PUT `/{id}`; delete: DELETE `/{id}`; dropdown options: GET `/options` where used.
- `/dashboard/stats`, `/dashboard/charts`, `/dashboard/activity`
- `/reports/students`, `/reports/faculty`, `/reports/academic`, plus individual/export routes per implementation.
- `/health` checks API/database status.

Typical outcomes: 200 success, 201 created, 404 not found, 409 duplicate/FK/capacity conflict, 422 invalid input, 503 DB busy/unavailable. FastAPI exposes interactive docs at `/docs`; Next's routes are handled by its App Router.

## 14. Seed data

The intended seed totals are 5 departments, 50 students, 15 faculty, 20 courses, 4 semesters, 30 offerings, 20 faculty assignments, 100 enrollments and 60 grades. PostgreSQL seed: `database/seed.sql`, regenerated by `scripts/generate_seed.py`; Next SQLite seed: `web/lib/seed.mjs`. Values are realistic demonstration records; all app screens query them live.

## 15. Architecture/file map

```text
backend/app/database.py                 PostgreSQL SQLAlchemy engine/session
backend/app/models/entities.py           ORM table/entity definitions
backend/app/routers/                     FastAPI HTTP endpoints
backend/app/services/queries.py          reusable joined queries
backend/app/services/enrollments.py      capacity + transaction logic
backend/app/services/dashboard.py        live stats/chart queries
backend/app/services/reports.py          report queries
backend/app/utils/pagination.py          sorting/pagination/CSV helpers
frontend/src/components/ResourcePage.jsx generic CRUD/list/form UI
frontend/src/config/resources.js         frontend field/column/filter config
database/schema.sql                      PostgreSQL tables/keys/checks/indexes/views/triggers
database/seed.sql                        PostgreSQL demo data
database/queries.sql                     SQL demonstrations
web/app/api/[...path]/route.js            Next.js Node API adapter
web/lib/schema.mjs                        SQLite DDL
web/lib/queries.mjs                       SQLite joined row query definitions
web/lib/api.mjs                           SQLite connection, validation, dispatch, CRUD/filter/transactions
web/lib/reports.mjs                       SQLite report calculations
web/lib/seed.mjs                          SQLite demo data
web/src/components/ResourcePage.jsx       Next React CRUD/list/form UI
web/src/config/resources.js               Next screen configuration
learnit/                                  ER diagram, topics, normalization, viva notes
```

## 16. Verification and limitations

- `npm run build` from the root builds the Next.js workspace.
- `cd web && npm test` tests SQLite API behavior; `node scripts/ui-smoke.mjs` runs browser checks against the Next app.
- Original backend: `cd backend && .venv/bin/python -m pytest -q` (83 tests previously run against a dedicated test database); `scripts/verify_database.py` checks PostgreSQL schema objects.
- `cd frontend && npm run build` builds Vite; `frontend/scripts/ui-smoke.mjs` tests its UI.
- Authentication is intentionally not implemented; run as a local administrative demo, not publicly exposed.
- SQLite local file is suitable for a single-machine demo, not shared multi-instance production. PostgreSQL is the server database option.
- SQLite version performs list filtering/sorting/pagination in Node after loading joined resource rows; PostgreSQL applies these operations in SQL. For large datasets, move filtering and pagination into SQLite queries too.
- `database/schema.sql` is a development bootstrap that drops/recreates tables; do not use against valuable existing data.
- Seed counts can change after CRUD demonstrations, because they are real writable databases.

## 17. Fast viva summary

> “CampusOS manages college academic records through nine normalized relational tables. The UI calls an API; the server validates input and uses SQL to query or change the database. Joins match foreign keys to primary keys to show related names and records, while WHERE/GROUP BY/aggregates power filtered screens, dashboard charts and reports. Keys and constraints protect data; transactions and database triggers prevent over-capacity enrollment. The repository has a Next.js/SQLite local build and a separate React/Vite/FastAPI/PostgreSQL build.”
