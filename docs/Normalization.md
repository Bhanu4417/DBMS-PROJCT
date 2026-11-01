# Normalization Report — CampusOS (1NF → 2NF → 3NF)

This document proves that the nine relation schema used by CampusOS is in **Third
Normal Form**. Every claim is demonstrated with functional dependencies and a worked
decomposition, and the same reasoning is executed as SQL in
`database/normalization.sql`.

---

## 1. The starting point: an unnormalised registration sheet

A college office typically keeps a single sheet like this:

| enrollment_number | student_name | student_email | department_code | department_name | department_phone | course_code | course_name | course_credits | semester_name | academic_year | faculty_names | marks_obtained | max_marks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ENR2023001 | Aarav Sharma | aarav@college.edu.in | CSE | Computer Science and Engineering | 011-1111 | CSE-301 | Database Management Systems | 4 | Odd Semester | 2024-2025 | Meera Iyer, Sandeep Rao | 82 | 100 |
| ENR2023002 | Diya Patel | diya@college.edu.in | ECE | Electronics and Communication Engineering | 011-2222 | ECE-202 | Digital Logic Design | 3 | Odd Semester | 2024-2025 | Sandeep Rao | 74 | 100 |
| ENR2023001 | Aarav Sharma | aarav@college.edu.in | CSE | Computer Science and Engineering | 011-1111 | CSE-401 | Operating Systems | 3 | Odd Semester | 2024-2025 | Meera Iyer | 66 | 100 |

Call this relation `REG_RAW`. It is exactly what `database/normalization.sql`
creates and queries in Steps 0–4.

---

## 2. First Normal Form (1NF)

**Rule:** every attribute holds a single atomic value, there are no repeating
groups, and rows are unique.

`REG_RAW` violates 1NF:

- `faculty_names` holds several names — `'Meera Iyer, Sandeep Rao'` — inside one cell.
  This is a multi-valued attribute (a repeating group).
- Because of that list, the same enrollment/course combination appears with different
  numbers of names, so the relation has no stable key.

Step 1 of `normalization.sql` proves the violation:

```sql
SELECT enrollment_number, course_code, faculty_names,
       array_length(string_to_array(faculty_names, ','), 1) AS values_in_one_cell
  FROM reg_raw;
```

**Fix:** split one row into one row per faculty member (Step 2):

```sql
SELECT enrollment_number, course_code,
       btrim(unnest(string_to_array(faculty_names, ','))) AS faculty_name
  FROM reg_raw;
```

After this step every cell is atomic. The relation `REG_1NF` has the composite key
`(enrollment_number, course_code, faculty_name)`.

The final schema satisfies 1NF for the same reason: a teacher's involvement is stored
as a **row** in `faculty_assignment`, not as a comma-separated string in `enrollment`.
No column in the schema holds a list, array or repeating group.

---

## 3. Second Normal Form (2NF)

**Rule:** the relation is in 1NF **and** every non-key attribute depends on the
*whole* candidate key, not part of it.

Candidate key of `REG_1NF`: `(enrollment_number, course_code, faculty_name)`.

Functional dependencies observed:

| FD | Meaning |
| --- | --- |
| `enrollment_number → student_name, student_email, department_code` | The student's details |
| `course_code → course_name, course_credits` | The course details |
| `department_code → department_name, department_phone` | The department details |
| `(enrollment_number, course_code) → marks_obtained, max_marks, semester_name, academic_year` | The grade for that registration |

`student_name` depends on **only** `enrollment_number`, which is a proper subset of
the key. `course_name` depends on **only** `course_code`. These are **partial
dependencies**, so `REG_1NF` is not in 2NF (Step 3 shows the offending columns).

**Fix:** give each entity its own relation keyed by the attribute that determines it:

- `STUDENT(enrollment_number, student_name, student_email, department_code)`
- `COURSE(course_code, course_name, course_credits)`
- `ENROLLMENT_FACT(enrollment_number, course_code, semester_name, academic_year, marks_obtained, max_marks)`
- `ASSIGNMENT_FACT(faculty_name, course_code, semester_name, academic_year)`

Now every non-key column depends on the whole key of its relation. In the delivered
schema, surrogate keys (`student_id`, `course_id`) are used as the primary key of each
entity table, and the association tables carry their own surrogate key plus a
`UNIQUE` **candidate** key that expresses the real-world identity — e.g.
`UNIQUE (student_id, offering_id)` on `enrollment`. There is no partial dependency in
any table because no table mixes two entities' attributes.

---

## 4. Third Normal Form (3NF)

**Rule:** the relation is in 2NF and no non-key attribute depends transitively on the
key (no `key → A → B` chain, equivalently: every determinant of a non-trivial FD is a
superkey).

The partially decomposed relation still contains a transitive dependency:

```
enrollment_number → department_code → department_name, department_phone
```

`department_name` and `department_phone` are not determined by the student directly —
they are determined by the department, which is itself determined by the student.
This produces update anomalies:

- Changing the CSE office phone requires updating **every** CSE row (Step 4 counts
  them). Forgetting one row leaves two different phone numbers for the same department.
- A department with no students cannot be recorded.
- Deleting the last student of a department erases the department's own information.

**Fix:** move the department facts into their own relation whose key is
`department_code`, and keep only the key (`department_id`) in `STUDENT` as a foreign
key. This is Step 5 of `normalization.sql`, and it mirrors the physical schema:

```
DEPARTMENT(department_id PK, department_code UK, department_name UK, office_location)
STUDENT(student_id PK, enrollment_number UK, ..., department_id FK, status)
```

The same reasoning removes every other transitive dependency:

| Removed transitive dependency | Where the fact now lives |
| --- | --- |
| student → department → department_name | `department.department_name` |
| course → department → department_name | `department.department_name` |
| offering → course → course_name, credits | `course.course_name`, `course.credits` |
| offering → semester → semester_name, year | `semester.*` |
| enrollment → offering → course_id | `course_offering.course_id` |
| grade → enrollment → student_id | `enrollment.student_id` |
| offering → capacity/enrolled → seats_available | **derived**, never stored |

The last row matters: "seats available" and "utilisation %" are computed in SQL
(`v_offering_utilization`, `GET /api/offerings`), because storing a derived value would
create the dependency `offering_id → enrolled_count → seats_available`.

---

## 5. Candidate keys of the final schema

| Relation | Candidate key(s) | Chosen primary key |
| --- | --- | --- |
| department | `department_id`, `department_code`, `department_name` | `department_id` |
| student | `student_id`, `enrollment_number`, `email` | `student_id` |
| faculty | `faculty_id`, `employee_code`, `email` | `faculty_id` |
| course | `course_id`, `course_code` | `course_id` |
| semester | `semester_id`, (`semester_name`, `academic_year`) | `semester_id` |
| course_offering | `offering_id`, (`course_id`, `semester_id`, `section`) | `offering_id` |
| faculty_assignment | `assignment_id`, (`faculty_id`, `offering_id`) | `assignment_id` |
| enrollment | `enrollment_id`, (`student_id`, `offering_id`) | `enrollment_id` |
| grade | `grade_id`, `enrollment_id` | `grade_id` |

Every alternate key is enforced with a real `UNIQUE` constraint, so the variables that
could otherwise duplicate data are impossible at the storage level.

---

## 6. Proof that each relation is in 3NF

For each relation, list the FDs and check that every determinant is a candidate key.

**department**
FDs: `department_id → {code, name, office_location, created_at}`,
`department_code → {department_id, name, …}`, `department_name → {department_id, code, …}`.
All determinants are candidate keys ⇒ 3NF (and BCNF).

**student**
FDs: `student_id → everything`; `enrollment_number → everything`;
`email → everything`. `department_id` determines *nothing* inside this table — it only
points to a department row ⇒ no transitive dependency ⇒ 3NF (and BCNF).

**faculty** — same shape as student: `faculty_id`, `employee_code` and `email` are
candidate keys; `department_id` is a pure reference ⇒ 3NF/BCNF.

**course** — `course_id` and `course_code` are candidate keys; `credits` and
`course_name` are facts about the course itself; `department_id` is a reference ⇒ 3NF.

**semester** — candidate keys `semester_id` and (`semester_name`, `academic_year`);
`start_date`, `end_date`, `status` describe the term ⇒ 3NF.

**course_offering** — candidate keys `offering_id` and
(`course_id`, `semester_id`, `section`); `capacity` is a fact about this offering, not
about the course or semester (a course may have different capacities in different
terms) ⇒ 3NF.

**faculty_assignment** — candidate keys `assignment_id` and
(`faculty_id`, `offering_id`); the only non-key attribute `assigned_at` depends on the
whole pair ⇒ 3NF.

**enrollment** — candidate keys `enrollment_id` and (`student_id`, `offering_id`);
`enrollment_date` and `enrollment_status` describe the registration itself, not the
student or the course ⇒ 3NF.

**grade** — candidate keys `grade_id` and `enrollment_id`; `marks_obtained`,
`max_marks`, `grade_letter`, `updated_at` depend only on the enrollment ⇒ 3NF.

### BCNF note (beyond the requirement)

BCNF additionally requires every determinant of every non-trivial FD to be a
candidate key. Each relation above has only candidate-key determinants, so the schema
is in fact in **BCNF**. It is *not* in 4NF/5NF territory because there are no
multi-valued or join dependencies left — the two many-to-many relationships have
already been reduced to association tables.

---

## 7. Why normalization is visible in the application

Because facts live in exactly one place:

- Renaming a department is one `UPDATE department …`; students, faculty and courses
  immediately display the new name through joins (`GET /api/students` joins
  `department` instead of copying `department_name`).
- A course's credits are stored once; `v_enrollment_details` and the student
  transcript join to `course` rather than repeating credits per enrollment.
- A student's email is stored once, protected by `uq_student_email`; there is no second
  copy to fall out of date.
- Grade rows store only `enrollment_id`; student name, course name and semester are
  obtained with joins (see `GET /api/grades`, `v_enrollment_details`).

The verification script `scripts/verify_database.py` prints these checks in Step 8 of
`normalization.sql`: the number of students equals the number of distinct emails, the
number of departments equals the number of distinct department names, and the same for
courses — i.e. no duplicated fact rows.
