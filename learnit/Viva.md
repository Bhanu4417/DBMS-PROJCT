# Viva: short answers and accepted values

**Why DBMS rather than spreadsheets?** Keys, joins, shared integrity and atomic transactions protect related facts.

**Schema versus instance?** Schema is the table/constraint definition; instance is the rows at a particular time.

**Candidate key versus primary key?** A candidate key is a minimal superkey; one is selected as PK, others remain UNIQUE NOT NULL alternate keys.

**Is each component of a composite key unique?** No. The whole tuple is unique; the offering key is (course_id, semester_id, section).

**What identifies a natural registration?** Student enrollment number plus course code, semester name, academic year and section. Physically: UNIQUE(student_id, offering_id).

**Can a department exist without students, staff or courses?** Yes. FKs require a referenced parent for a child, not a child for each parent.

**Which FK is optional?** Only student.department_id. Every other FK requires exactly one parent. An enrollment's grade is optional, but a grade's enrollment is mandatory.

**Why a separate offering?** Course facts are stable catalog facts; semester, section and capacity describe an occurrence.

**Why a separate grade table?** An enrollment may be ungraded; UNIQUE enrollment_id permits at most one grade row.

**Is grade_letter computed from marks?** No. It is an independently recorded allowed value. No threshold/formula dependency is enforced.

**Does adding an ID prove 2NF?** No. Check partial dependencies against every candidate key, including composites.

**What proves a lossless binary split?** The shared attributes functionally determine one resulting relation.

**What is 3NF?** Each nontrivial FD has a superkey determinant or a prime dependent attribute. Requiring every determinant to be a superkey is BCNF.

**WHERE versus HAVING?** WHERE filters input rows; HAVING filters aggregate groups.

**INNER versus LEFT JOIN?** INNER discards unmatched rows; LEFT preserves the left row with NULL right attributes.

**Do indexes always help?** They accelerate suitable lookups but cost storage and write work; inspect query plans.

**How is the last seat protected locally?** BEGIN IMMEDIATE serializes writers before capacity checks and insert, with trigger enforcement and rollback. SQLite does not use PostgreSQL FOR UPDATE.

**Why RESTRICT, not CASCADE deletion?** Preserve dependent history; remove dependents explicitly or retire records by status.

**Is the local DB in RAM?** No, it is a disposable persisted SQLite file. PostgreSQL is the original design, not the new service's database.

## Constraint accepted values

These domains are present in both inspected schemas unless noted. NULL is allowed only where stated; omission can invoke a default, explicit NULL does not.

| Field | Accepted values / condition |
| --- | --- |
| student.status | Active, Graduated, Inactive; default Active |
| semester.status | Upcoming, Active, Completed; default Upcoming |
| enrollment.enrollment_status | Enrolled, Completed, Dropped; default Enrolled |
| student.gender | Female, Male, Non-binary, Prefer not to say, or NULL |
| grade.grade_letter | A+, A, B+, B, C, D, F, or NULL |
| admission_year | Integer 2000–2100 |
| credits | Integer 1–6 |
| capacity | Database > 0; local API integer 1–500 |
| max_marks | > 0; no DB default; local API defaults to 100 on creation |
| marks_obtained | NULL or 0 ≤ marks_obtained ≤ max_marks |
| department_code | Regex `^[A-Z]{2,10}$` |
| course_code | Regex `^[A-Z]{2,6}-?[0-9]{3,4}$`, e.g. CSE-301 |
| academic_year | Exactly four digits, hyphen, four digits; consecutive years are not enforced |
| semester dates | end_date > start_date; local API validates real YYYY-MM-DD dates |
| faculty.joining_date | NULL or >= 1950-01-01 |
| student/faculty email | Unique within its own table; simple nonspace local@domain.suffix format, not proof of delivery |
| student/faculty phone | NULL or 7–15 characters from digits, +, space and hyphen |
| FK values | Existing parent ID; student.department_id alone may be NULL |

Nullable non-key facts: department.office_location; student.phone/date_of_birth/gender; faculty.phone/designation/joining_date; course.description; grade.marks_obtained/grade_letter. All PKs and all alternate candidate-key columns are required. Section has no A/B-only domain: the local API permits nonempty text of 1–20 characters.

Non-Dropped enrollments (including Completed) occupy capacity under the current rule. Dropped does not free the UNIQUE(student_id, offering_id) identity: update/reactivate that registration instead of inserting a duplicate.
