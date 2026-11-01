# Normalization: worked correction

## Assumptions and keys

A registration is for a **course offering**, not merely a course. A student can take the same course in different semesters; sections distinguish offerings within a semester. Faculty names are not unique identifiers. Use employee codes.

For the worked example let S = enrollment_number, C = course_code, T = semester_name, Y = academic_year, X = section, F = employee_code. O = (C,T,Y,X), K = (S,C,T,Y,X). Assume these natural identifiers are stable and unique as in the schema. Email and department-name alternate keys are retained in the final-key table below; the teaching relation below omits emails to avoid silently omitting their alternate candidate keys.

## Unnormalized sheet → 1NF

A sheet has columns `(S, student_first, student_last, student_dept_code, student_dept_name, C, course_name, credits, T, Y, start_date, end_date, X, capacity, enrollment_date, enrollment_status, marks_obtained, max_marks, grade_letter, teachers)`.

Example teachers cell: `[(EMP01, Meera), (EMP02, Sandeep)]`. This repeating group violates 1NF. A list does **not** itself prove that the sheet lacks a key.

Instead of duplicating registrations once per teacher, separate the independent teacher relationship:

- `REG_1NF(K, student_first, student_last, student_dept_code, student_dept_name, course_name, credits, start_date, end_date, capacity, enrollment_date, enrollment_status, marks_obtained, max_marks, grade_letter)`.
- `TEACH_1NF(O,F,faculty_first,faculty_last)`.

All cells are scalar. Under the stated dependencies, the only candidate key of REG_1NF is K; the only candidate key of TEACH_1NF is `(C,T,Y,X,F)`. Student/faculty names are not identifiers. If flattening both into a single teacher-per-registration relation instead, its key would be `(S,C,T,Y,X,F)`, **not** `(S,C,faculty_name)`; such a flat table also loses registrations having no assigned teacher.

### Concrete registration rows (selected columns)

| S | C | T | Y | X | marks | max | letter |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ENR001 | CSE-301 | Odd | 2024-2025 | A | 82 | 100 | A |
| ENR001 | CSE-301 | Odd | 2025-2026 | A | 74 | 100 | B+ |
| ENR002 | CSE-301 | Odd | 2024-2025 | A | 66 | 100 | B |
| ENR002 | CSE-301 | Odd | 2024-2025 | B | 78 | 100 | A |

The schema permits the last two registrations: uniqueness is per offering, not per course/term. Without Y or X, distinct rows can collide. Removing S allows different students to collide; removing C or T permits collisions across courses or terms. K is minimal under the FDs, not merely unique in this tiny sample.

## Functional dependencies

Use declared business rules, not coincidences in sample data:

- `S → student_first, student_last, student_dept_code`.
- `student_dept_code → student_dept_name` (for assigned departments).
- `C → course_name, credits`.
- `(T,Y) → start_date, end_date`.
- `O → capacity`.
- `K → enrollment_date, enrollment_status, marks_obtained, max_marks, grade_letter`.
- `F → faculty_first, faculty_last`.

Neither marks nor a percentage determines grade_letter: **the letter is independently recorded**, with a domain CHECK but no grading-formula constraint. Nor is max_marks assumed constant for a course or offering. SQL NULL for an unassigned department or missing grade is handled by optional relationships; textbook FD proofs apply to the corresponding known facts, not by treating NULL as a real department key.

## 1NF → 2NF: remove partial dependencies

2NF means 1NF and no non-prime attribute depends on a proper subset of **any** candidate key. A surrogate PK alone is not a proof.

Decompose into:

- `STUDENT_2(S PK, student_first, student_last, student_dept_code, student_dept_name)`.
- `COURSE_2(C PK, course_name, credits)`.
- `TERM_2(T PK-part, Y PK-part, start_date, end_date)`.
- `OFFERING_2(C PK-part, T PK-part, Y PK-part, X PK-part, capacity)`.
- `REG_2(S PK-part, C PK-part, T PK-part, Y PK-part, X PK-part, enrollment_date, enrollment_status, marks_obtained, max_marks, grade_letter)`.
- `FACULTY_2(F PK, faculty_first, faculty_last)`.
- `ASSIGNMENT_2(C PK-part, T PK-part, Y PK-part, X PK-part, F PK-part)`.

Each listed PK is the sole candidate key under this example's FDs. S, C, (T,Y), and O were proper subsets of K; F was a proper subset of the teacher key. Their facts are now stored once. STUDENT_2 is 2NF but still has the transitive department dependency.

## 2NF → 3NF: remove transitive department facts

Split STUDENT_2 into `STUDENT_3(S, student_first, student_last, student_dept_code)` and `DEPARTMENT_3(student_dept_code, student_dept_name)`.

This removes `S → student_dept_code → student_dept_name`. Otherwise renaming a department requires many updates, its last student deletion loses its name, and a department cannot exist without a student. In SQL, keep an independent department table and a nullable FK, so empty departments and unassigned students remain representable.

Formal 3NF: for each nontrivial FD `A → b`, A is a superkey **or b is prime** (belongs to some candidate key). “Every determinant is a superkey” is the stronger BCNF criterion. Under the stated intra-table FDs the final tables meet 3NF; no claim about arbitrary unstated FDs or 4NF/5NF is needed.

## Why the decomposition is lossless

For a binary decomposition R into R1 and R2, it is lossless if their intersection determines R1 or R2. Each extraction above meets this criterion:

| Extracted facts | Shared attributes | What they determine |
| --- | --- | --- |
| Student | S | STUDENT_2 |
| Course | C | COURSE_2 |
| Term | (T,Y) | TERM_2 |
| Offering | O | OFFERING_2 |
| Faculty | F | FACULTY_2 |
| Department | department code | DEPARTMENT_3 |

Apply these splits successively; joining on the shared keys reconstructs the original facts without spurious combinations. For example, course CSE-301 joins to exactly one course-details row, not to another semester's registration. These FDs remain enforceable within individual tables (dependency preservation).

Splitting a teachers list is a separate modeling step: assume teachers belong to the offering independently of student enrollment, then REG and ASSIGNMENT represent that independence. It is not justified by the binary FD test alone. A teacher-per-registration flattening would require the relevant multivalued independence assumption to reconstruct all combinations.

In the delivered design, ID keys replace long natural joins without erasing natural UNIQUE constraints. Enrollment date/status stay in enrollment; optional grade facts move to grade, linked by UNIQUE NOT NULL enrollment_id. An inner join reconstructs graded enrollments; use a LEFT JOIN to retain enrollments with no grade. Do not claim an inner join preserves optional absent rows.

## Actual final candidate keys

Each parenthesized tuple is **one** candidate key; every PK is also a candidate key. All alternate-key columns are NOT NULL.

| Table | All candidate keys (first is PK) |
| --- | --- |
| department | department_id; department_code; department_name |
| student | student_id; enrollment_number; email |
| faculty | faculty_id; employee_code; email |
| course | course_id; course_code |
| semester | semester_id; (semester_name, academic_year) |
| course_offering | offering_id; (course_id, semester_id, section) |
| faculty_assignment | assignment_id; (faculty_id, offering_id) |
| enrollment | enrollment_id; (student_id, offering_id) |
| grade | grade_id; enrollment_id |

For each table every listed key determines all its attributes; no additional non-key determinant is assumed. Capacity belongs to an offering, credits to a course, assigned_at to an assignment, and grade facts to an enrollment. Referenced department/course details are not duplicated in child tables. Derived seat counts are computed rather than stored, avoiding stale summaries; that is a consistency choice, not by itself a formal 3NF proof.
