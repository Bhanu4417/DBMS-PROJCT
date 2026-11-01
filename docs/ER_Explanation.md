# ER Model — Relationships, Cardinalities and Participation

This document explains the diagram in `docs/ER_Diagram.md` in plain language. The
rendered picture is `docs/ER_Diagram.png`.

## 1. Entities and their keys

| Entity | Primary key | Candidate (alternate) keys |
| --- | --- | --- |
| Department | `department_id` | `department_code`, `department_name` |
| Student | `student_id` | `enrollment_number`, `email` |
| Faculty | `faculty_id` | `employee_code`, `email` |
| Course | `course_id` | `course_code` |
| Semester | `semester_id` | (`semester_name`, `academic_year`) |
| CourseOffering | `offering_id` | (`course_id`, `semester_id`, `section`) |
| FacultyAssignment | `assignment_id` | (`faculty_id`, `offering_id`) |
| Enrollment | `enrollment_id` | (`student_id`, `offering_id`) |
| Grade | `grade_id` | `enrollment_id` (one grade per enrollment) |

Surrogate keys are used for joins, while every "real world" identifier is protected
by a `UNIQUE` constraint, so the database cannot contain two students with the same
enrollment number or two identical offerings.

## 2. Relationship-by-relationship explanation

### 2.1 Department — Student (1 : N)

- One department can have many students; a student belongs to **at most one** department.
- Participation: department side is **optional** (a new department may have no students
  yet). Student side is **optional** because transfer students can be admitted before a
  department is assigned — the column is nullable by design.
- Implemented by `student.department_id` → `department.department_id` with `ON DELETE RESTRICT`.
- Deleting a department that still has students returns HTTP 409 and lists the count.

### 2.2 Department — Faculty (1 : N)

- One department employs many faculty; every faculty member belongs to **exactly one**
  department ⇒ total (mandatory) participation on the faculty side.
- `faculty.department_id` is `NOT NULL`; the API also verifies the department exists and
  returns 404 when it does not.

### 2.3 Department — Course (1 : N)

- A department owns many courses; every course belongs to exactly one department
  (mandatory participation), which is why `course.department_id` is `NOT NULL`.

### 2.4 Course — CourseOffering (1 : N)

- A course can be offered zero or many times (once per semester/section).
- Each offering references exactly one course (mandatory).
- `UNIQUE (course_id, semester_id, section)` stops the same course being scheduled twice
  in the same semester and section.

### 2.5 Semester — CourseOffering (1 : N)

- A semester may contain zero or many offerings (optional on the semester side).
- Every offering belongs to exactly one semester (mandatory).
- A semester can only be deleted when it has no offerings.

### 2.6 Faculty — CourseOffering (M : N via FacultyAssignment)

- A faculty member can teach many offerings; an offering can be taught by several faculty
  members (team teaching).
- The relationship is resolved by the `faculty_assignment` association entity, whose
  primary key `assignment_id` is a surrogate and whose candidate key is
  (`faculty_id`, `offering_id`) — this prevents duplicate assignments.
- Participation is optional on both sides: a faculty member may teach nothing in a given
  term, and an offering may be created before a teacher is assigned.
- Removing an assignment deletes only the link row, never the faculty member or offering.

### 2.7 Student — CourseOffering (M : N via Enrollment)

- A student registers for many offerings; an offering contains many students.
- Resolved by `enrollment`, with candidate key (`student_id`, `offering_id`) preventing a
  double registration.
- The association carries its own attributes: `enrollment_date` (defaults to
  `CURRENT_DATE`) and `enrollment_status` (`Enrolled`, `Completed`, `Dropped`).
- Participation: optional from both sides. An offering is often created before anyone
  registers; a student exists before their first enrollment.
- Capacity is a constraint on this relationship, enforced by a row lock plus a trigger.

### 2.8 Enrollment — Grade (1 : 0..1)

- An enrollment may have **zero or one** grade; a grade always belongs to exactly one
  enrollment.
- `grade.enrollment_id` is `UNIQUE NOT NULL`, which is what makes the "at most one"
  rule a database guarantee rather than an application convention.
- Grade is a weak-ish dependent entity: deleting an enrollment that has a grade is
  blocked, preserving academic history.

## 3. Why the model has no redundancy

- No table stores `student_name`, `course_name`, `department_name` or `semester_name`
  more than once. Enrollments and grades store only foreign keys, and the API joins
  (`v_enrollment_details`, `v_offering_utilization`) to display readable names.
- Derived values (enrolled count, seats available, utilisation %) are computed in SQL,
  never stored. Storing them would create a transitive dependency and a possible
  inconsistency.
- The two many-to-many relationships have no attributes that belong to the parent
  entities, only their own (`assigned_at`, `enrollment_date`, `enrollment_status`).

## 4. Mapping the diagram to tables

| ER construct | Relational implementation |
| --- | --- |
| Strong entity | One table with a surrogate primary key |
| 1:N relationship | Foreign key on the "many" side |
| M:N relationship | Separate association table with two foreign keys |
| Optional participation | Nullable foreign key (only `student.department_id`) |
| Mandatory participation | `NOT NULL` foreign key |
| 1:0..1 relationship | Foreign key with a `UNIQUE` constraint (`grade.enrollment_id`) |
| Multi-valued attribute | Not present — would require its own table (already normalised) |
