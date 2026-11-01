# Database Constraints — CampusOS

Every rule below is enforced **inside PostgreSQL**, not just in the browser. The API
validates first (so users see friendly messages), but the database is the final
authority: even `psql` cannot insert an invalid row.

Verify everything in one command:

```bash
python scripts/verify_database.py     # checks tables, keys, checks, triggers, views, indexes
```

---

## 1. Primary keys (9/9 tables)

| Table | Primary key | Purpose |
| --- | --- | --- |
| department | `department_id` | Surrogate key for stable references |
| student | `student_id` | Surrogate key, referenced by enrollments |
| faculty | `faculty_id` | Surrogate key, referenced by assignments |
| course | `course_id` | Surrogate key, referenced by offerings |
| semester | `semester_id` | Surrogate key, referenced by offerings |
| course_offering | `offering_id` | Surrogate key, referenced by enrollments/assignments |
| faculty_assignment | `assignment_id` | Surrogate key for the M:N link |
| enrollment | `enrollment_id` | Surrogate key, referenced by grades |
| grade | `grade_id` | Surrogate key |

Without a primary key a table can contain duplicate rows and cannot be referenced by a
foreign key, so every table declares one.

## 2. Foreign keys (10)

| Constraint | Definition | On delete |
| --- | --- | --- |
| `fk_student_department` | `student.department_id → department.department_id` | `RESTRICT` |
| `fk_faculty_department` | `faculty.department_id → department.department_id` | `RESTRICT` |
| `fk_course_department` | `course.department_id → department.department_id` | `RESTRICT` |
| `fk_offering_course` | `course_offering.course_id → course.course_id` | `RESTRICT` |
| `fk_offering_semester` | `course_offering.semester_id → semester.semester_id` | `RESTRICT` |
| `fk_assignment_faculty` | `faculty_assignment.faculty_id → faculty.faculty_id` | `RESTRICT` |
| `fk_assignment_offering` | `faculty_assignment.offering_id → course_offering.offering_id` | `RESTRICT` |
| `fk_enrollment_student` | `enrollment.student_id → student.student_id` | `RESTRICT` |
| `fk_enrollment_offering` | `enrollment.offering_id → course_offering.offering_id` | `RESTRICT` |
| `fk_grade_enrollment` | `grade.enrollment_id → enrollment.enrollment_id` | `RESTRICT` |

**Why `RESTRICT` and not `CASCADE`?** Academic history is evidence. Deleting a student
must not silently erase their grades, and deleting a semester must not delete the
enrollments that reference it. With `RESTRICT` the database refuses the delete and the
API turns that into a readable message:

```
HTTP 409  Cannot delete this department: 10 student(s) depend on it
```

`ON UPDATE CASCADE` is used because surrogate keys are stable; if one is ever
renumbered, references follow automatically.

**Deliberate exception / archival policy:** to retire a student or a registration
without losing history, the application changes a status
(`student.status = 'Inactive'`, `enrollment_status = 'Dropped'`) instead of deleting.
Voluntary deletes are still allowed when *nothing* depends on the row (e.g. a
department that has no students, faculty or courses).

## 3. Unique constraints (12)

| Constraint | Table | Rule |
| --- | --- | --- |
| `uq_department_code` | department | No two departments share a code |
| `uq_department_name` | department | No two departments share a name |
| `uq_student_enrollment_number` | student | Enrollment number is the public student identity |
| `uq_student_email` | student | One account per email |
| `uq_faculty_employee_code` | faculty | Employee code is the staff identity |
| `uq_faculty_email` | faculty | One account per email |
| `uq_course_code` | course | Course catalogue code is unique |
| `uq_semester_term` | semester | (`semester_name`, `academic_year`) identifies a term |
| `uq_offering_course_semester_section` | course_offering | One section per course per semester |
| `uq_assignment_faculty_offering` | faculty_assignment | A faculty member cannot be assigned twice to one offering |
| `uq_enrollment_student_offering` | enrollment | A student cannot register twice for one offering |
| `uq_grade_enrollment` | grade | At most one grade per enrollment (1:0..1 relationship) |

These are also the **candidate keys** discussed in `docs/Normalization.md`. Duplicate
inserts produce `HTTP 409` with a field-specific message, e.g.
"That enrollment number is already used by another student."

## 4. NOT NULL constraints

| Table | Mandatory columns |
| --- | --- |
| department | `department_code`, `department_name`, `created_at` |
| student | `enrollment_number`, `first_name`, `last_name`, `email`, `admission_year`, `status`, `created_at` |
| faculty | `employee_code`, `first_name`, `last_name`, `email`, `department_id`, `created_at` |
| course | `course_code`, `course_name`, `credits`, `department_id` |
| semester | `semester_name`, `academic_year`, `start_date`, `end_date`, `status` |
| course_offering | `course_id`, `semester_id`, `section`, `capacity`, `created_at` |
| faculty_assignment | `faculty_id`, `offering_id`, `assigned_at` |
| enrollment | `student_id`, `offering_id`, `enrollment_date`, `enrollment_status` |
| grade | `enrollment_id`, `max_marks`, `updated_at` |

`student.department_id`, `student.phone`, `student.date_of_birth`, `student.gender`,
`faculty.phone`, `faculty.designation`, `faculty.joining_date`, `course.description`,
`grade.marks_obtained` and `grade.grade_letter` are intentionally nullable: they are
optional facts, and making them mandatory would force fake data.

## 5. CHECK constraints (15)

| Constraint | Rule | Why it matters |
| --- | --- | --- |
| `ck_course_credits` | `credits BETWEEN 1 AND 6` | Prevents a 0-credit or 40-credit course |
| `ck_offering_capacity` | `capacity > 0` | A class must have room for at least one student |
| `ck_semester_dates` | `end_date > start_date` | Prevents inverted terms |
| `ck_semester_status` | `IN ('Upcoming','Active','Completed')` | Keeps the status domain closed |
| `ck_semester_academic_year` | matches `YYYY-YYYY` | Keeps years sortable/comparable |
| `ck_student_status` | `IN ('Active','Graduated','Inactive')` | Closed domain |
| `ck_student_gender` | documented four values or NULL | No free-text genders |
| `ck_student_admission_year` | `BETWEEN 2000 AND 2100` | Blocks typos like 20255 |
| `ck_student_email_format` | simple email regex | Catches obviously broken emails |
| `ck_student_phone_format` | 7–15 digits/spaces/`+`/`-` | Prevents garbage in phone columns |
| `ck_faculty_email_format` | simple email regex | Same as above |
| `ck_faculty_phone_format` | 7–15 digits/spaces/`+`/`-` | Same as above |
| `ck_faculty_joining_date` | `>= 1950-01-01` | Blocks impossible dates |
| `ck_enrollment_status` | `IN ('Enrolled','Completed','Dropped')` | Closed domain |
| `ck_grade_letter` | `IN ('A+','A','B+','B','C','D','F')` | Documented grading scale |
| `ck_grade_marks_non_negative` | `marks_obtained >= 0` | No negative marks |
| `ck_grade_max_positive` | `max_marks > 0` | Prevents division by zero |
| `ck_grade_marks_within_max` | `marks_obtained <= max_marks` | 90/80 is impossible |
| `ck_department_code_format` | `^[A-Z]{2,10}$` | Codes stay short and uppercase |
| `ck_course_code_format` | `^[A-Z]{2,6}-?[0-9]{3,4}$` | Codes like `CSE-301` |

## 6. DEFAULT constraints

| Column | Default |
| --- | --- |
| all `created_at` columns | `CURRENT_TIMESTAMP` |
| `enrollment.enrollment_date` | `CURRENT_DATE` |
| `student.status` | `'Active'` |
| `semester.status` | `'Upcoming'` |
| `grade.max_marks` (API layer) | `100` |
| `grade.updated_at` | `CURRENT_TIMESTAMP` (refreshed by trigger on update) |
| `faculty_assignment.assigned_at` | `CURRENT_TIMESTAMP` |

## 7. Business rules enforced by triggers

PostgreSQL `CHECK` constraints cannot count rows, so two rules are implemented as
PL/pgSQL triggers. They are tested in `backend/tests/test_database_constraints.py`.

### 7.1 Offering capacity (`trg_enrollment_capacity`)

```
BEFORE INSERT OR UPDATE OF offering_id, enrollment_status ON enrollment
```

1. `SELECT capacity FROM course_offering WHERE offering_id = NEW.offering_id FOR UPDATE`
   — this row lock serialises concurrent enrollments for the same offering.
2. Count enrollments whose status is not `Dropped`.
3. `RAISE EXCEPTION 'Course offering % is at full capacity (% seats)'` when full.

Consequence: two simultaneous requests for the last seat cannot both succeed. The
pytest test `test_concurrent_enrollments_never_exceed_capacity` proves that exactly one
of two parallel requests gets `201` and the other gets `409`.

### 7.2 Capacity reduction (`trg_offering_capacity_reduction`)

```
BEFORE UPDATE OF capacity ON course_offering
```

Refuses to shrink a class below the number of students already enrolled:
`Capacity 10 is below the 24 students already enrolled`.

### 7.3 Grade timestamp (`trg_grade_touch`)

Sets `grade.updated_at = CURRENT_TIMESTAMP` on every update so the audit time is
trustworthy even if a client forgets the column.

## 8. Indexes (13)

| Index | Columns | Query it supports |
| --- | --- | --- |
| `idx_student_department` | student(department_id) | Department filter, join to department |
| `idx_student_status` | student(status) | Active/inactive filters and dashboard counts |
| `idx_student_admission` | student(admission_year) | Admissions-by-year chart |
| `idx_student_name` | student(last_name, first_name) | Name sorting/search |
| `idx_faculty_department` | faculty(department_id) | Faculty-by-department report |
| `idx_course_department` | course(department_id) | Courses of a department |
| `idx_offering_semester` | course_offering(semester_id) | Offerings per semester |
| `idx_offering_course` | course_offering(course_id) | Offerings of a course |
| `idx_assignment_offering` | faculty_assignment(offering_id) | Faculty names for an offering |
| `idx_enrollment_offering` | enrollment(offering_id) | Capacity count, roster |
| `idx_enrollment_student` | enrollment(student_id) | Student transcript |
| `idx_enrollment_status` | enrollment(enrollment_status) | Dashboard donut chart |
| `idx_grade_letter` | grade(grade_letter) | Grade distribution report |

Unique constraints also create indexes automatically, so lookups by
`enrollment_number`, `email`, `course_code`, `(student_id, offering_id)` etc. are
indexed as well.

## 9. Views

| View | Contents |
| --- | --- |
| `v_enrollment_details` | Enrollment + student + department + course + semester + grade (the transcript join) |
| `v_offering_utilization` | Capacity, enrolled count and utilisation % per offering |
| `v_student_academic_summary` | Active courses, completed credits and average percentage per student |

Views keep the API from duplicating join logic and demonstrate that derived values are
computed, never stored.
