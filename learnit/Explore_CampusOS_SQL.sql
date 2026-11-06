-- CampusOS SQLite: read-only exploration examples
-- Run from the project root:
--   sqlite3 -readonly -header -column web/lib/.data/campus.sqlite < learnit/Explore_CampusOS_SQL.sql
-- These statements only SELECT data. Use the website's Admin CRUD screens to insert/update.

-- 1) List application tables (does not read credentials or sessions).
SELECT name AS table_name
FROM sqlite_master
WHERE type='table'
  AND name NOT LIKE 'sqlite_%'
  AND name NOT IN ('portal_account','portal_session','login_throttle','portal_migration')
ORDER BY name;

-- 2) Check whether a student record was inserted most recently.
-- IDs can have gaps; newest ID is a useful first check, not a timestamp guarantee.
SELECT student_id,
       enrollment_number,
       first_name || ' ' || last_name AS full_name,
       email,
       admission_year,
       status
FROM student
ORDER BY student_id DESC
LIMIT 20;

-- 3) Find a student by part of their name, email, or enrollment number.
-- Replace 'Asha' with the text to search for.
SELECT student_id,
       enrollment_number,
       first_name || ' ' || last_name AS full_name,
       email,
       status
FROM student
WHERE first_name LIKE '%Asha%'
   OR last_name LIKE '%Asha%'
   OR email LIKE '%Asha%'
   OR enrollment_number LIKE '%Asha%'
ORDER BY last_name, first_name;

-- 4) Find a specific recently inserted row using its unique email/enrollment number.
-- Replace example@college.edu with the exact value entered in the admin form.
SELECT student_id, enrollment_number, first_name, last_name, email
FROM student
WHERE email = 'example@college.edu';

-- 5) Verify totals after inserting a student/faculty/course.
SELECT 'students' AS entity, count(*) AS row_count FROM student
UNION ALL SELECT 'faculty', count(*) FROM faculty
UNION ALL SELECT 'courses', count(*) FROM course
UNION ALL SELECT 'enrollments', count(*) FROM enrollment
UNION ALL SELECT 'grades', count(*) FROM grade;

-- 6) Read an enrollment with the student's name, offering, term, and optional grade.
SELECT e.enrollment_id,
       st.enrollment_number,
       st.first_name || ' ' || st.last_name AS student_name,
       c.course_code,
       c.course_name,
       sem.semester_name,
       sem.academic_year,
       e.enrollment_status,
       g.marks_obtained,
       g.max_marks,
       g.grade_letter
FROM enrollment e
JOIN student st USING (student_id)
JOIN course_offering o USING (offering_id)
JOIN course c USING (course_id)
JOIN semester sem USING (semester_id)
LEFT JOIN grade g USING (enrollment_id)
ORDER BY e.enrollment_id DESC
LIMIT 25;

-- 7) See grade rows and calculate the percentage safely.
SELECT g.grade_id,
       st.enrollment_number,
       st.first_name || ' ' || st.last_name AS student_name,
       c.course_code,
       g.marks_obtained,
       g.max_marks,
       round(100.0 * g.marks_obtained / nullif(g.max_marks, 0), 2) AS percentage,
       g.grade_letter
FROM grade g
JOIN enrollment e USING (enrollment_id)
JOIN student st USING (student_id)
JOIN course_offering o USING (offering_id)
JOIN course c USING (course_id)
ORDER BY g.grade_id DESC
LIMIT 25;

-- 8) Query the optional Person / Student / Faculty EER identity layer.
-- It has no rows until an administrator explicitly creates Person links in /eer.
SELECT person_id,
       student_name,
       faculty_name,
       student_enrollment_number,
       faculty_employee_code,
       contact_count
FROM v_person_eer
ORDER BY person_id DESC;

-- 9) Display contacts for each explicitly created Person.
SELECT pc.person_id,
       v.student_name,
       v.faculty_name,
       pc.contact_type,
       pc.contact_value
FROM person_contact pc
JOIN v_person_eer v USING (person_id)
ORDER BY pc.person_id DESC, pc.contact_type, pc.contact_value;

-- 10) Check whether a matching department exists before adding a related record.
SELECT department_id, department_code, department_name
FROM department
ORDER BY department_code;

-- To enter data, use Admin > Students (or the relevant CRUD page), save, then
-- rerun the SELECT above. If the website had the row open already, press Refresh.
-- Inserts via the UI also run app validation and foreign-key/business rules.
-- Direct SQL writes are deliberately not included in this read-only worksheet.
