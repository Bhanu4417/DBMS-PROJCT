# CampusOS: current extended ER model

## Deliverables

- **Conceptual domain plate:** [editable SVG](CampusOS_Conceptual_ER.svg), [PNG](CampusOS_Conceptual_ER.png), [one-page PDF](CampusOS_Conceptual_ER.pdf).
- **Full relational plate:** [editable SVG](CampusOS_Relational_ER.svg), [PNG](CampusOS_Relational_ER.png).
- [Exact schema inventory](CampusOS_schema.json): all columns, declared types, nullability, defaults, unique sets, FK actions and original CREATE TABLE SQL (including CHECKs).
- [Reproducible generator](render-campus-er-v2.mjs): run `node learnit/render-campus-er-v2.mjs` from the repository root. It inventories the current SQLite/Next.js schema in an isolated database. The original renderer and plates are retained as historical earlier-version artifacts.


Sources are the current `web/lib/schema.mjs` and `web/lib/portal.mjs`, not the original PostgreSQL report. The generator builds an isolated in-memory SQLite schema directly from those definitions and inventories it. These are implementation-derived diagrams, not a claim that a production database has been inspected. The isolated SQLite inventory currently contains 18 tables and 18 foreign keys. It retains the 10 academic-domain tables, four auth/support tables, and the four additive Person/contact EER tables.

## Current scope and retired library tables

The Library feature has been removed from both current website panels and API. Runtime initialization drops legacy <code>library_loan</code> first and then <code>library_book</code>. The independent PostgreSQL/FastAPI build and historical PDFs may still describe earlier library functionality.



The authorized hospital report's **page 2** was rendered with `pdftoppm`; its embedded ER illustration was also extracted with `pdfimages`. It is a Chen conceptual reference using entity rectangles, relationship diamonds, attribute ellipses and underlined identifiers. The new conceptual plate follows that visual vocabulary, in monochrome on white, with a report heading and explicit cardinalities. It is **not an exact copy of the hospital diagram's topology**: CampusOS has different entities and constraints. No hospital personnel specialization, composite address or multivalued phone/qualification is imported into CampusOS.

The conceptual plate intentionally shows selected descriptive attributes and primary keys. Foreign-key relationships replace FK ellipses there; **the relational plate is authoritative for the complete column list**, types, optionality and keys. The editable SVGs are the diagram source; no Mermaid installation is needed. Associative entities stay rectangles because their actual rows have their own surrogate IDs and attributes.

## Scope and notation

**Current academic domain (10):** department, student, faculty, course, semester, course_offering, faculty_assignment, enrollment, grade, attendance. Library tables have been retired from this website.

**Technical auth/support (4):** portal_account, portal_session, login_throttle, portal_migration. The migration table exists in `initializePortal`: its `name` key records the `demo-v1` seed marker. It is not an academic entity or a migration-history relationship.

In the Chen plate, the label adjacent to an entity says how many instances of the **opposite entity** one row can relate to. In the relational register, counts are explicitly ordered **child → parent; parent → child**. All parent-to-child minima are zero: no FK forces a parent to have a dependent row. NN refers to the declared SQL NOT NULL flag, not API validation.

## All 18 implemented foreign-key relationships

| Child FK → parent PK | Parents per child | Children per parent |
|---|---:|---:|
| student.department_id → department.department_id | 0..1 | 0..N |
| faculty.department_id → department.department_id | 1 | 0..N |
| course.department_id → department.department_id | 1 | 0..N |
| course_offering.course_id → course.course_id | 1 | 0..N |
| course_offering.semester_id → semester.semester_id | 1 | 0..N |
| faculty_assignment.faculty_id → faculty.faculty_id | 1 | 0..N |
| faculty_assignment.offering_id → course_offering.offering_id | 1 | 0..N |
| enrollment.student_id → student.student_id | 1 | 0..N |
| enrollment.offering_id → course_offering.offering_id | 1 | 0..N |
| grade.enrollment_id → enrollment.enrollment_id | 1 | 0..1 |
| attendance.enrollment_id → enrollment.enrollment_id | 1 | 0..N |
| portal_account.student_id → student.student_id | 0..1 (role-dependent) | 0..1 |
| portal_session.account_id → portal_account.account_id | 1 | 0..N |

All deletes are RESTRICT except session → account, which is CASCADE. Academic9 FKs use ON UPDATE CASCADE; portal extensions omit ON UPDATE, hence SQLite NO ACTION. The relational plate uses R identifiers to disambiguate connectors; the register is definitive where routes cross.

### Accounts, students and faculty — not ISA

`portal_account.role` is restricted to `admin` or `student`. A CHECK requires **admin → NULL student_id** and **student → non-NULL student_id**. The UNIQUE student FK permits at most one account per student. A student can exist with no account. Multiple admin accounts can have NULL student IDs. An account is not a superclass; roles are not subtype tables. `faculty` has its own employee identity and department relationship, **no account FK and no faculty login role**. An admin account does not imply a faculty record. Account email is independently stored: student account creation copies the student's email, but no FK, CHECK or trigger in these files enforces continuing email equality.

`portal_session` stores a token hash (not the raw cookie), an account FK and millisecond expiry. `login_throttle.key_hash` hashes normalized email, including emails with no account; it is **not an account FK**. It stores attempt count and millisecond reset time. No fabricated relationship connects throttle or migration to the academic domain.

## Keys and complete attributes

Every column is in the relational plate and schema JSON; keys are underlined. Integer primary keys are rowid-backed identifiers; the original nine use explicit AUTOINCREMENT. Extension integer PKs do not. Non-primary unique constraints are:

- department: code; name (separately).
- student: enrollment_number; email (separately).
- faculty: employee_code; email (separately).
- course: course_code.
- semester: (semester_name, academic_year).
- course_offering: (course_id, semester_id, section).
- faculty_assignment: (faculty_id, offering_id).
- enrollment: (student_id, offering_id).
- grade: enrollment_id.
- attendance: (enrollment_id, date).
- portal_account: email (COLLATE NOCASE); student_id (nullable).

Attendance belongs to an enrollment, not independently to a student or course. Grades have a unique required enrollment FK, so an enrollment can have zero or one grade, never an enforced grade.

**SQLite caveat:** `portal_session.token_hash`, `login_throttle.key_hash` and `portal_migration.name` are declared `TEXT PRIMARY KEY` without explicit NOT NULL in ordinary rowid tables. SQLite permits NULL in these declarations; the plate faithfully shows the nullable declaration even though application paths supply non-null hashes/names. INTEGER PRIMARY KEY identities are effectively non-null rowids even when PRAGMA reports `notnull=0`. Do not read an underlined TEXT PK as an additional NOT NULL guarantee absent from the SQL.

## Implemented constraints and defaults

The exact SQL is preserved in the JSON; the following is the human-readable implementation summary.

- **Department:** uppercase code of 2–10 letters; created_at defaults to CURRENT_TIMESTAMP.
- **Student:** admission_year 2000–2100; status Active/Graduated/Inactive, default Active; gender nullable or Female/Male/Non-binary/Prefer not to say. Email regex and nullable 7–15-character phone regex. created_at defaults to CURRENT_TIMESTAMP; department optional.
- **Faculty:** required department; email/nullable phone regex; joining_date nullable or at least 1950-01-01; created_at defaults to CURRENT_TIMESTAMP.
- **Course:** credits 1–6; code 2–6 uppercase letters, optional hyphen, then 3–4 digits. Description nullable.
- **Semester:** end_date > start_date; academic_year matches YYYY-YYYY (no consecutive-year arithmetic CHECK). Status Upcoming/Active/Completed, default Upcoming.
- **Offering:** capacity > 0; created_at defaults to CURRENT_TIMESTAMP. Capacity is not an FK cardinality and does not imply a SQL enrollment-count constraint.
- **Assignment:** assigned_at defaults to CURRENT_TIMESTAMP.
- **Enrollment:** enrollment_date defaults to CURRENT_DATE; status Enrolled/Completed/Dropped, default Enrolled.
- **Grade:** max_marks > 0; marks_obtained nullable, otherwise 0 ≤ marks ≤ max; grade_letter nullable or A+/A/B+/B/C/D/F. updated_at defaults to CURRENT_TIMESTAMP; that default alone does not auto-update the timestamp on every UPDATE.
- **Attendance:** status Present/Absent/Late/Excused; required TEXT date. One row per enrollment/date. No SQL date-format CHECK.
- **Account:** required email, role, salt and password hash; role/link CHECK described above. No SQL password-strength CHECK.
- **Session/throttle/migration:** no additional CHECKs or defaults beyond the definitions inventoried above.

The portal API validates real YYYY-MM-DD dates, positive safe-integer IDs and field lengths. Passwords created through `/admin/accounts` must have 12–256 characters. Login uses scrypt password derivation, SHA-256 token/email hashes, eight-hour sessions and a five-attempt/15-minute throttle. These are application behaviors, **not additional ER relationships or SQL CHECKs**. The independent PostgreSQL application can have different validation.

## Verification

Generated current entity and relationship inventory from Chromium/Puppeteer; the current SQLite schema contains 18 tables and 18 declared foreign keys. `npm test` passes all 15 web suites. The historical renderer/plates may retain entities from earlier project versions.

## Historical study pack

`ER_Diagram.md`, `.mmd`, `.svg` and `.png` remain untouched and describe the **historical academic9-only scope**. They are not complete diagrams of the current portal. The older normalization/architecture/viva chapters also remain study material for that original scope; use this page and the new plates for the extended implementation.

## Library retirement

The current website no longer includes Library screens or endpoints. On runtime initialization, any legacy `library_loan` rows are deleted first, then `library_book` rows/tables. Other academic, attendance, EER and account data are retained. This removal is specific to the Next.js/SQLite website; historical learning materials and the independent PostgreSQL build may document earlier library features.
