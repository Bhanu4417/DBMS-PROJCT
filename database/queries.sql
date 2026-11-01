-- =============================================================================
-- queries.sql — SQL demonstrations for the viva / practical examination.
--
-- Run after schema.sql + seed.sql:
--     psql -d college -f database/queries.sql
--
-- Write operations happen inside a transaction that is rolled back, so running
-- this file never changes the seeded data.
-- =============================================================================

\echo '================ 1. SELECT ... WHERE (row filtering) ================='
-- Active students admitted in 2023 or later.
SELECT student_id, enrollment_number, first_name, last_name, admission_year, status
  FROM student
 WHERE status = 'Active'
   AND admission_year >= 2023
 ORDER BY admission_year DESC, first_name
 LIMIT 10;

\echo '================ 2. INNER JOIN (students with their department) ================='
SELECT s.enrollment_number, s.first_name || ' ' || s.last_name AS student,
       d.department_code, d.department_name
  FROM student s
  INNER JOIN department d ON d.department_id = s.department_id
 ORDER BY d.department_code, student
 LIMIT 10;

\echo '================ 3. LEFT JOIN (departments, including empty ones) ================='
SELECT d.department_code,
       d.department_name,
       count(s.student_id) AS students
  FROM department d
  LEFT JOIN student s ON s.department_id = d.department_id
 GROUP BY d.department_id
 ORDER BY d.department_code;

\echo '================ 4. GROUP BY + aggregate functions ================='
SELECT sm.semester_name,
       sm.academic_year,
       count(DISTINCT o.offering_id)                 AS offerings,
       count(e.enrollment_id)                        AS enrollments,
       count(DISTINCT e.student_id)                  AS students,
       round(avg(g.marks_obtained), 2)               AS average_marks
  FROM semester sm
  LEFT JOIN course_offering o ON o.semester_id = sm.semester_id
  LEFT JOIN enrollment e      ON e.offering_id = o.offering_id
  LEFT JOIN grade g           ON g.enrollment_id = e.enrollment_id
 GROUP BY sm.semester_id
 ORDER BY sm.start_date;

\echo '================ 5. HAVING (filtering groups) ================='
-- Offerings that are at least 20% full.
SELECT c.course_code,
       sm.semester_name,
       o.section,
       o.capacity,
       count(e.enrollment_id) FILTER (WHERE e.enrollment_status <> 'Dropped') AS enrolled
  FROM course_offering o
  JOIN course c         ON c.course_id = o.course_id
  JOIN semester sm      ON sm.semester_id = o.semester_id
  LEFT JOIN enrollment e ON e.offering_id = o.offering_id
 GROUP BY o.offering_id, c.course_code, sm.semester_name, o.section, o.capacity
HAVING count(e.enrollment_id) FILTER (WHERE e.enrollment_status <> 'Dropped') >= 3
 ORDER BY enrolled DESC, c.course_code;

\echo '================ 6. ORDER BY (sorting) ================='
SELECT course_code, course_name, credits
  FROM course
 ORDER BY credits DESC, course_name ASC
 LIMIT 10;

\echo '================ 7. Aggregate functions (count, min, max, avg, sum) ================='
SELECT count(*)                    AS total_students,
       count(*) FILTER (WHERE status = 'Active')    AS active_students,
       count(*) FILTER (WHERE status = 'Graduated') AS graduated_students,
       min(admission_year)        AS earliest_admission,
       max(admission_year)        AS latest_admission
  FROM student;

SELECT round(min(marks_obtained), 2) AS lowest_marks,
       round(max(marks_obtained), 2) AS highest_marks,
       round(avg(marks_obtained), 2) AS average_marks,
       round(avg(marks_obtained / max_marks * 100), 2) AS average_percentage
  FROM grade;

\echo '================ 8. Nested subquery (IN / NOT EXISTS) ================='
-- Courses that have been offered at least once.
SELECT course_code, course_name
  FROM course
 WHERE course_id IN (SELECT course_id FROM course_offering)
 ORDER BY course_code;

-- Students who have no enrollment yet.
SELECT s.enrollment_number, s.first_name || ' ' || s.last_name AS student
  FROM student s
 WHERE NOT EXISTS (SELECT 1 FROM enrollment e WHERE e.student_id = s.student_id)
 ORDER BY s.enrollment_number;

\echo '================ 9. Multiple-table join (full academic transcript) ================='
SELECT s.enrollment_number,
       s.first_name || ' ' || s.last_name AS student,
       d.department_code,
       c.course_code,
       c.course_name,
       c.credits,
       sm.semester_name,
       sm.academic_year,
       o.section,
       e.enrollment_status,
       g.marks_obtained,
       g.max_marks,
       g.grade_letter
  FROM enrollment e
  JOIN student s         ON s.student_id = e.student_id
  LEFT JOIN department d ON d.department_id = s.department_id
  JOIN course_offering o ON o.offering_id = e.offering_id
  JOIN course c          ON c.course_id = o.course_id
  JOIN semester sm       ON sm.semester_id = o.semester_id
  LEFT JOIN grade g      ON g.enrollment_id = e.enrollment_id
 ORDER BY s.enrollment_number, c.course_code
 LIMIT 15;

\echo '================ 10-13. INSERT / UPDATE / DELETE / TRANSACTION ================='
-- A transaction is a group of statements that succeed or fail together.
-- Everything below is rolled back so the demonstration leaves no traces.
BEGIN;

-- 10. INSERT: a new department, then a course inside it.
INSERT INTO department (department_code, department_name, office_location)
VALUES ('TST', 'Demonstration Engineering', 'Demo Block')
RETURNING department_id, department_code, department_name;

-- 11. UPDATE: rename the office of the department we just inserted.
UPDATE department
   SET office_location = 'Demo Block, Room 9'
 WHERE department_code = 'TST'
RETURNING department_code, office_location;

-- Reaching this point proves the INSERT and UPDATE succeeded.
SELECT department_code, office_location
  FROM department
 WHERE department_code = 'TST';

-- 12. DELETE: remove the demonstration row again.
DELETE FROM department
 WHERE department_code = 'TST'
RETURNING department_code;

-- 13. Undo everything done above (demonstrates atomicity + rollback).
ROLLBACK;

-- Proof the rollback restored the original data: this returns 0 rows.
SELECT count(*) AS demonstration_rows_left_behind
  FROM department
 WHERE department_code = 'TST';

\echo '================ 14. VIEW (saved join, reused like a table) ================='
SELECT offering_id, course_code, semester_name, capacity, enrolled, utilisation_percent
  FROM v_offering_utilization
 ORDER BY utilisation_percent DESC, course_code
 LIMIT 10;

SELECT student_name, course_code, marks_obtained, grade_letter
  FROM v_enrollment_details
 WHERE grade_letter IS NOT NULL
 ORDER BY marks_obtained DESC
 LIMIT 10;

\echo '================ 15. INDEX (and proof that the planner can use it) ================='
CREATE INDEX IF NOT EXISTS idx_student_email_lookup ON student (email);

EXPLAIN (COSTS OFF)
SELECT enrollment_number, first_name
  FROM student
 WHERE email = 'aarav.sharma1@student.college.edu.in';

\echo '================ Bonus: capacity is enforced in the database ================='
-- Uncomment to see the trigger reject an over-capacity enrollment:
-- INSERT INTO enrollment (student_id, offering_id) VALUES (1, 1);

\echo '================ Bonus: window function (rank students by marks) ================='
SELECT student_name,
       course_code,
       marks_obtained,
       grade_letter,
       rank() OVER (PARTITION BY course_code ORDER BY marks_obtained DESC) AS position_in_course
  FROM v_enrollment_details
 WHERE marks_obtained IS NOT NULL
 ORDER BY course_code, position_in_course
 LIMIT 15;
