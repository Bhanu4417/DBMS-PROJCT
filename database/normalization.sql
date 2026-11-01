-- =============================================================================
-- normalization.sql — worked example used by docs/Normalization.md
--
-- Every statement here is self-contained: temporary tables only, so running it
-- never modifies the seeded college database. Run with:
--     psql -d college -f database/normalization.sql
-- =============================================================================

\echo '=== STEP 0: the unnormalised registration sheet (as a college clerk keeps it) ==='

DROP TABLE IF EXISTS reg_raw;
CREATE TEMP TABLE reg_raw (
    enrollment_number VARCHAR(30),
    student_name      VARCHAR(100),
    student_email     VARCHAR(150),
    department_code   VARCHAR(10),
    department_name   VARCHAR(100),
    department_phone  VARCHAR(15),
    course_code       VARCHAR(20),
    course_name       VARCHAR(150),
    course_credits    INTEGER,
    semester_name     VARCHAR(50),
    academic_year     VARCHAR(9),
    faculty_names     TEXT,          -- comma separated list -> repeating group
    marks_obtained    NUMERIC(5,2),
    max_marks         NUMERIC(5,2)
);

INSERT INTO reg_raw VALUES
 ('ENR2023001','Aarav Sharma','aarav@college.edu.in','CSE','Computer Science and Engineering','011-1111','CSE-301','Database Management Systems',4,'Odd Semester','2024-2025','Meera Iyer, Sandeep Rao',82,100),
 ('ENR2023002','Diya Patel','diya@college.edu.in','ECE','Electronics and Communication Engineering','011-2222','ECE-202','Digital Logic Design',3,'Odd Semester','2024-2025','Sandeep Rao',74,100),
 ('ENR2023001','Aarav Sharma','aarav@college.edu.in','CSE','Computer Science and Engineering','011-1111','CSE-401','Operating Systems',3,'Odd Semester','2024-2025','Meera Iyer',66,100);

SELECT * FROM reg_raw ORDER BY enrollment_number, course_code;

\echo '=== STEP 1: 1NF violation — faculty_names holds several values ==='

SELECT enrollment_number, course_code, faculty_names,
       array_length(string_to_array(faculty_names, ','), 1) AS values_in_one_cell
  FROM reg_raw
 ORDER BY enrollment_number, course_code;

\echo '=== STEP 2: 1NF — split the repeating group into one atomic row per faculty ==='

DROP TABLE IF EXISTS reg_1nf;
CREATE TEMP TABLE reg_1nf AS
SELECT enrollment_number, student_name, student_email, department_code, department_name,
       department_phone, course_code, course_name, course_credits, semester_name,
       academic_year, btrim(unnest(string_to_array(faculty_names, ','))) AS faculty_name,
       marks_obtained, max_marks
  FROM reg_raw;

SELECT enrollment_number, course_code, faculty_name FROM reg_1nf
 ORDER BY enrollment_number, course_code, faculty_name;

\echo '=== STEP 3: 2NF violation — non-key attributes depend on part of the key ==='
-- Candidate key of the sheet is (enrollment_number, course_code, faculty_name).
-- student_name depends only on enrollment_number, course_name only on course_code.

SELECT enrollment_number, student_name, course_code, course_name, faculty_name
  FROM reg_1nf
 ORDER BY enrollment_number, course_code;

\echo '=== STEP 4: 3NF violation — transitive dependency student -> department -> phone ==='

SELECT student_email, department_code, department_name, department_phone
  FROM reg_1nf
 WHERE enrollment_number = 'ENR2023001'
 ORDER BY department_code;

\echo '--- update anomaly: changing the CSE phone must touch every CSE row ---'

SELECT count(*) AS rows_that_must_change
  FROM reg_1nf
 WHERE department_code = 'CSE';

\echo '=== STEP 5: decomposition into 3NF relations ==='

-- 5a. Department (department_code is the candidate key)
DROP TABLE IF EXISTS norm_department;
CREATE TEMP TABLE norm_department AS
SELECT DISTINCT department_code, department_name, department_phone
  FROM reg_1nf;

-- 5b. Student (enrollment_number is the candidate key)
DROP TABLE IF EXISTS norm_student;
CREATE TEMP TABLE norm_student AS
SELECT DISTINCT enrollment_number, student_name, student_email, department_code
  FROM reg_1nf;

-- 5c. Course (course_code is the candidate key)
DROP TABLE IF EXISTS norm_course;
CREATE TEMP TABLE norm_course AS
SELECT DISTINCT course_code, course_name, course_credits
  FROM reg_1nf;

-- 5d. Enrollment / grade facts keyed by (enrollment_number, course_code)
DROP TABLE IF EXISTS norm_enrollment;
CREATE TEMP TABLE norm_enrollment AS
SELECT DISTINCT enrollment_number, course_code, semester_name, academic_year,
       marks_obtained, max_marks
  FROM reg_1nf;

-- 5e. Faculty assignment facts keyed by (faculty_name, course_code, semester_name)
DROP TABLE IF EXISTS norm_assignment;
CREATE TEMP TABLE norm_assignment AS
SELECT DISTINCT faculty_name, course_code, semester_name, academic_year
  FROM reg_1nf;

SELECT * FROM norm_department ORDER BY department_code;
SELECT * FROM norm_student ORDER BY enrollment_number;
SELECT * FROM norm_course ORDER BY course_code;

\echo '=== STEP 6: the decomposed model answers the same question with joins ==='

SELECT s.enrollment_number,
       s.student_name,
       d.department_name,
       c.course_code,
       c.course_name,
       c.course_credits,
       e.marks_obtained,
       e.max_marks
  FROM norm_student s
  JOIN norm_department d ON d.department_code = s.department_code
  JOIN norm_enrollment e ON e.enrollment_number = s.enrollment_number
  JOIN norm_course c     ON c.course_code = e.course_code
 ORDER BY s.enrollment_number, c.course_code;

\echo '=== STEP 7: the same facts from the real schema (no duplicated strings) ==='

SELECT v.enrollment_number,
       v.student_name,
       v.department_code,
       v.course_code,
       v.course_name,
       v.credits,
       v.marks_obtained,
       v.grade_letter
  FROM v_enrollment_details v
 ORDER BY v.enrollment_id
 LIMIT 10;

\echo '=== STEP 8: proof that the live schema keeps one copy of each fact ==='

SELECT 'students' AS fact, count(*) AS rows FROM student
UNION ALL SELECT 'distinct emails', count(DISTINCT email) FROM student
UNION ALL SELECT 'departments', count(*) FROM department
UNION ALL SELECT 'distinct department names', count(DISTINCT department_name) FROM department
UNION ALL SELECT 'courses', count(*) FROM course
UNION ALL SELECT 'distinct course names', count(DISTINCT course_name) FROM course;

-- Expected: every "rows" value equals its "distinct" partner, i.e. no duplicated
-- student, department or course fact exists anywhere in the database.
