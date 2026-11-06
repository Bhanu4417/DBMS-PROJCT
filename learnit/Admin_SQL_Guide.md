# Admin panel: SQL used to find names and records

This guide is for the **Next.js 15 + SQLite** website. Its admin screens call JSON API endpoints; they do **not** send free-form SQL from the browser. Server-side query templates and CRUD code live in `web/lib/queries.mjs`, `web/lib/api.mjs`, and `web/lib/portal.mjs`.

For visual context, see [CampusOS ER/EER v2 (PDF)](CampusOS_ER_EER_v2.pdf), which includes all 20 current SQLite tables and an SQL appendix. [Editable HTML](CampusOS_ER_EER_v2.html) · [reproducible generator](render-campus-er-v2.mjs).

## Student names in Admin → Students

The query template in `queries.students` is:

```sql
SELECT s.*,
       s.first_name || ' ' || s.last_name AS full_name,
       d.department_name,
       (SELECT count(*)
          FROM enrollment
         WHERE student_id = s.student_id) AS enrollment_count
FROM student s
LEFT JOIN department d USING (department_id);
```

`first_name || ' ' || last_name` makes the display name. `LEFT JOIN` keeps students with a NULL department. The admin screen gets rows from `/api/students` via the generic `ResourcePage` configured in `web/src/config/resources.js`.

### Exact search implementation detail

The API's current `filtered()` implementation sorts and filters the query results in JavaScript. Its `search` parameter does **not** cause the database to execute the following `LIKE` SQL; this is a standalone SQL equivalent useful for learning/querying directly:

```sql
SELECT student_id, enrollment_number,
       first_name || ' ' || last_name AS full_name,
       email, status
FROM student
WHERE first_name LIKE '%' || ? || '%'
   OR last_name  LIKE '%' || ? || '%'
ORDER BY last_name, first_name;
```

The `?` values are bound parameters, not SQL text concatenated from a user's search.

## Faculty names in Admin → Faculty

Actual query template `queries.faculty`:

```sql
SELECT f.*,
       f.first_name || ' ' || f.last_name AS full_name,
       d.department_name,
       (SELECT count(*)
          FROM faculty_assignment
         WHERE faculty_id = f.faculty_id) AS assignment_count
FROM faculty f
JOIN department d USING (department_id);
```

The inner join is safe for the implemented schema because `faculty.department_id` is required. Faculty/course/semester filters and sorting are applied by the API after it obtains these joined rows.

## Enrollment, course and grade names

Actual template `queries.enrollments`, abbreviated to explain the joins:

```sql
SELECT e.*,
       st.enrollment_number,
       st.first_name || ' ' || st.last_name AS student_name,
       d.department_name,
       c.course_code, c.course_name, c.credits,
       sem.semester_name, sem.academic_year,
       g.grade_letter, g.marks_obtained, g.max_marks
FROM enrollment e
JOIN student st USING (student_id)
LEFT JOIN department d ON d.department_id = st.department_id
JOIN course_offering o USING (offering_id)
JOIN course c USING (course_id)
JOIN semester sem USING (semester_id)
LEFT JOIN grade g USING (enrollment_id);
```

Grades are optional until entered, so `LEFT JOIN grade` preserves ungraded enrollments.

## Find a person through the EER extension

`/eer` asks the server for `/api/eer/people`. The database view used to resolve the explicit role links is:

```sql
CREATE VIEW v_person_eer AS
SELECT p.person_id, p.created_at,
       ps.student_id, s.enrollment_number AS student_enrollment_number,
       CASE WHEN s.student_id IS NOT NULL
            THEN trim(s.first_name || ' ' || s.last_name) END AS student_name,
       pf.faculty_id, f.employee_code AS faculty_employee_code,
       CASE WHEN f.faculty_id IS NOT NULL
            THEN trim(f.first_name || ' ' || f.last_name) END AS faculty_name,
       (SELECT count(*) FROM person_contact pc
         WHERE pc.person_id = p.person_id) AS contact_count
FROM campus_person p
LEFT JOIN person_student ps USING (person_id)
LEFT JOIN student s USING (student_id)
LEFT JOIN person_faculty pf USING (person_id)
LEFT JOIN faculty f USING (faculty_id);
```

Useful standalone reads:

```sql
SELECT person_id, student_name, faculty_name,
       student_enrollment_number, faculty_employee_code, contact_count
FROM v_person_eer
ORDER BY person_id;

SELECT person_id, contact_type, contact_value
FROM person_contact
WHERE person_id = ?
ORDER BY contact_type, contact_value;
```

The API also selects `person_contact` rows once for each displayed Person. Role matching is **explicit**; matching names/emails does not automatically link two records.

## Reports shown in the admin UI

The Student, Faculty, and Academic report tabs call `/api/reports/students`, `/api/reports/faculty`, and `/api/reports/academic`. Report assembly is implemented in `web/lib/reports.mjs`; several reports operate on already-joined rows in JavaScript rather than one SQL `GROUP BY` statement.

Equivalent example for students by department:

```sql
SELECT d.department_code, d.department_name,
       count(s.student_id) AS students
FROM department d
LEFT JOIN student s USING (department_id)
GROUP BY d.department_id
ORDER BY d.department_code;
```

The current implementation computes course grades percentage in `queries.grades`:

```sql
round(g.marks_obtained * 100.0 / g.max_marks, 2) AS percentage
```

## CRUD and viewing the real SQL templates

The API uses prepared statements for records and only accepts predefined resource/table/field names. Conceptual CRUD examples:

```sql
SELECT * FROM student WHERE student_id = ?;
INSERT INTO student (enrollment_number, first_name, last_name, email,
                     admission_year, status)
VALUES (?, ?, ?, ?, ?, ?);
UPDATE student SET last_name = ? WHERE student_id = ?;
DELETE FROM student WHERE student_id = ?;
```

`?` denotes a bound parameter. Do not interpolate user input into SQL. The delete may be rejected by foreign-key restrictions if the student has academic history.

To inspect the application's real redacted templates, sign in as admin and open **SQL activity** in the sidebar. It polls `/api/dbviewer` and shows SQL templates, request route, duration, success and row counts. It intentionally excludes authentication/account/session SQL and parameter values. It is a bounded in-memory audit view, **not a SQL editor**.

## One-sentence viva answer

> “The admin website requests named API resources; the server runs prepared SQLite query templates, joining student or faculty to departments and constructing full names with `first_name || ' ' || last_name`. Search and reporting have some JavaScript-side filtering/aggregation. The SQL activity page displays redacted executed templates, not user-entered SQL.”

The separate original PostgreSQL/FastAPI application has its own queries and schema; do not describe these SQLite templates as its runtime queries.
