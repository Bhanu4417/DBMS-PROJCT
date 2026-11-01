-- =============================================================================
-- CampusOS — College Management System
-- PostgreSQL schema (3NF), constraints, indexes, views and integrity triggers.
--
-- Apply with:  psql -d college -f database/schema.sql
-- WARNING: this script drops and recreates every table (development bootstrap).
-- =============================================================================

BEGIN;

DROP VIEW IF EXISTS v_enrollment_details CASCADE;
DROP VIEW IF EXISTS v_offering_utilization CASCADE;
DROP VIEW IF EXISTS v_student_academic_summary CASCADE;

DROP TABLE IF EXISTS grade CASCADE;
DROP TABLE IF EXISTS enrollment CASCADE;
DROP TABLE IF EXISTS faculty_assignment CASCADE;
DROP TABLE IF EXISTS course_offering CASCADE;
DROP TABLE IF EXISTS semester CASCADE;
DROP TABLE IF EXISTS course CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS student CASCADE;
DROP TABLE IF EXISTS department CASCADE;

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENT
--    A department is the organisational owner of students, faculty and courses.
-- -----------------------------------------------------------------------------
CREATE TABLE department (
    department_id   SERIAL PRIMARY KEY,
    department_code VARCHAR(10)  NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    office_location VARCHAR(100),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_department_code UNIQUE (department_code),
    CONSTRAINT uq_department_name UNIQUE (department_name),
    CONSTRAINT ck_department_code_format CHECK (department_code ~ '^[A-Z]{2,10}$')
);

-- -----------------------------------------------------------------------------
-- 2. STUDENT
-- -----------------------------------------------------------------------------
CREATE TABLE student (
    student_id        SERIAL PRIMARY KEY,
    enrollment_number VARCHAR(30) NOT NULL,
    first_name        VARCHAR(50) NOT NULL,
    last_name         VARCHAR(50) NOT NULL,
    email             VARCHAR(150) NOT NULL,
    phone             VARCHAR(15),
    date_of_birth     DATE,
    gender            VARCHAR(20),
    admission_year    INTEGER     NOT NULL,
    department_id     INTEGER,
    status            VARCHAR(20) NOT NULL DEFAULT 'Active',
    created_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_enrollment_number UNIQUE (enrollment_number),
    CONSTRAINT uq_student_email UNIQUE (email),
    CONSTRAINT fk_student_department FOREIGN KEY (department_id)
        REFERENCES department (department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_student_admission_year CHECK (admission_year BETWEEN 2000 AND 2100),
    CONSTRAINT ck_student_status CHECK (status IN ('Active', 'Graduated', 'Inactive')),
    CONSTRAINT ck_student_gender CHECK (
        gender IS NULL OR gender IN ('Female', 'Male', 'Non-binary', 'Prefer not to say')),
    CONSTRAINT ck_student_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    CONSTRAINT ck_student_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9+ -]{7,15}$')
);

-- -----------------------------------------------------------------------------
-- 3. FACULTY
-- -----------------------------------------------------------------------------
CREATE TABLE faculty (
    faculty_id    SERIAL PRIMARY KEY,
    employee_code VARCHAR(30)  NOT NULL,
    first_name    VARCHAR(50)  NOT NULL,
    last_name     VARCHAR(50)  NOT NULL,
    email         VARCHAR(150) NOT NULL,
    phone         VARCHAR(15),
    designation   VARCHAR(100),
    joining_date  DATE,
    department_id INTEGER      NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_faculty_employee_code UNIQUE (employee_code),
    CONSTRAINT uq_faculty_email UNIQUE (email),
    CONSTRAINT fk_faculty_department FOREIGN KEY (department_id)
        REFERENCES department (department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_faculty_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    CONSTRAINT ck_faculty_phone_format CHECK (phone IS NULL OR phone ~ '^[0-9+ -]{7,15}$'),
    CONSTRAINT ck_faculty_joining_date CHECK (joining_date IS NULL OR joining_date >= DATE '1950-01-01')
);

-- -----------------------------------------------------------------------------
-- 4. COURSE
-- -----------------------------------------------------------------------------
CREATE TABLE course (
    course_id     SERIAL PRIMARY KEY,
    course_code   VARCHAR(20)  NOT NULL,
    course_name   VARCHAR(150) NOT NULL,
    credits       INTEGER      NOT NULL,
    department_id INTEGER      NOT NULL,
    description   TEXT,
    CONSTRAINT uq_course_code UNIQUE (course_code),
    CONSTRAINT fk_course_department FOREIGN KEY (department_id)
        REFERENCES department (department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_course_credits CHECK (credits BETWEEN 1 AND 6),
    CONSTRAINT ck_course_code_format CHECK (course_code ~ '^[A-Z]{2,6}-?[0-9]{3,4}$')
);

-- -----------------------------------------------------------------------------
-- 5. SEMESTER
-- -----------------------------------------------------------------------------
CREATE TABLE semester (
    semester_id   SERIAL PRIMARY KEY,
    semester_name VARCHAR(50) NOT NULL,
    academic_year VARCHAR(9)  NOT NULL,
    start_date    DATE        NOT NULL,
    end_date      DATE        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'Upcoming',
    CONSTRAINT uq_semester_term UNIQUE (semester_name, academic_year),
    CONSTRAINT ck_semester_status CHECK (status IN ('Upcoming', 'Active', 'Completed')),
    CONSTRAINT ck_semester_dates CHECK (end_date > start_date),
    CONSTRAINT ck_semester_academic_year CHECK (academic_year ~ '^[0-9]{4}-[0-9]{4}$')
);

-- -----------------------------------------------------------------------------
-- 6. COURSE_OFFERING — a course taught in a semester, in a specific section.
-- -----------------------------------------------------------------------------
CREATE TABLE course_offering (
    offering_id SERIAL PRIMARY KEY,
    course_id   INTEGER   NOT NULL,
    semester_id INTEGER   NOT NULL,
    section     VARCHAR(20) NOT NULL,
    capacity    INTEGER   NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_offering_course_semester_section UNIQUE (course_id, semester_id, section),
    CONSTRAINT fk_offering_course FOREIGN KEY (course_id)
        REFERENCES course (course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_offering_semester FOREIGN KEY (semester_id)
        REFERENCES semester (semester_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_offering_capacity CHECK (capacity > 0)
);

-- -----------------------------------------------------------------------------
-- 7. FACULTY_ASSIGNMENT — resolves Faculty <-> CourseOffering many-to-many.
-- -----------------------------------------------------------------------------
CREATE TABLE faculty_assignment (
    assignment_id SERIAL PRIMARY KEY,
    faculty_id    INTEGER   NOT NULL,
    offering_id   INTEGER   NOT NULL,
    assigned_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assignment_faculty_offering UNIQUE (faculty_id, offering_id),
    CONSTRAINT fk_assignment_faculty FOREIGN KEY (faculty_id)
        REFERENCES faculty (faculty_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_assignment_offering FOREIGN KEY (offering_id)
        REFERENCES course_offering (offering_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------------------------------
-- 8. ENROLLMENT — resolves Student <-> CourseOffering many-to-many.
-- -----------------------------------------------------------------------------
CREATE TABLE enrollment (
    enrollment_id     SERIAL PRIMARY KEY,
    student_id        INTEGER   NOT NULL,
    offering_id       INTEGER   NOT NULL,
    enrollment_date   DATE      NOT NULL DEFAULT CURRENT_DATE,
    enrollment_status VARCHAR(20) NOT NULL DEFAULT 'Enrolled',
    CONSTRAINT uq_enrollment_student_offering UNIQUE (student_id, offering_id),
    CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id)
        REFERENCES student (student_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_enrollment_offering FOREIGN KEY (offering_id)
        REFERENCES course_offering (offering_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_enrollment_status CHECK (enrollment_status IN ('Enrolled', 'Completed', 'Dropped'))
);

-- -----------------------------------------------------------------------------
-- 9. GRADE — zero-or-one grade per enrollment (enrollment_id is UNIQUE).
-- -----------------------------------------------------------------------------
CREATE TABLE grade (
    grade_id      SERIAL PRIMARY KEY,
    enrollment_id INTEGER      NOT NULL,
    marks_obtained NUMERIC(5,2),
    max_marks     NUMERIC(5,2) NOT NULL,
    grade_letter  VARCHAR(2),
    updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_grade_enrollment UNIQUE (enrollment_id),
    CONSTRAINT fk_grade_enrollment FOREIGN KEY (enrollment_id)
        REFERENCES enrollment (enrollment_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_grade_marks_non_negative CHECK (marks_obtained IS NULL OR marks_obtained >= 0),
    CONSTRAINT ck_grade_max_positive CHECK (max_marks > 0),
    CONSTRAINT ck_grade_marks_within_max CHECK (marks_obtained IS NULL OR marks_obtained <= max_marks),
    CONSTRAINT ck_grade_letter CHECK (
        grade_letter IS NULL OR grade_letter IN ('A+', 'A', 'B+', 'B', 'C', 'D', 'F'))
);

-- =============================================================================
-- INDEXES — support the filters, joins and sorts used by the API.
-- =============================================================================
CREATE INDEX idx_student_department    ON student (department_id);
CREATE INDEX idx_student_status        ON student (status);
CREATE INDEX idx_student_admission     ON student (admission_year);
CREATE INDEX idx_student_name          ON student (last_name, first_name);
CREATE INDEX idx_faculty_department    ON faculty (department_id);
CREATE INDEX idx_course_department     ON course (department_id);
CREATE INDEX idx_offering_semester     ON course_offering (semester_id);
CREATE INDEX idx_offering_course       ON course_offering (course_id);
CREATE INDEX idx_assignment_offering   ON faculty_assignment (offering_id);
CREATE INDEX idx_enrollment_offering   ON enrollment (offering_id);
CREATE INDEX idx_enrollment_student    ON enrollment (student_id);
CREATE INDEX idx_enrollment_status     ON enrollment (enrollment_status);
CREATE INDEX idx_grade_letter          ON grade (grade_letter);

-- =============================================================================
-- INTEGRITY TRIGGERS
-- =============================================================================

-- Capacity is enforced in the database, not only in the API.
-- The offering row is locked, so concurrent enrollments cannot oversubscribe it.
CREATE OR REPLACE FUNCTION fn_enforce_offering_capacity() RETURNS TRIGGER AS $$
DECLARE
    v_capacity INTEGER;
    v_taken    INTEGER;
BEGIN
    IF NEW.enrollment_status = 'Dropped' THEN
        RETURN NEW;
    END IF;

    SELECT capacity INTO v_capacity
      FROM course_offering
     WHERE offering_id = NEW.offering_id
       FOR UPDATE;

    IF v_capacity IS NULL THEN
        RAISE EXCEPTION 'Course offering % does not exist', NEW.offering_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COUNT(*) INTO v_taken
      FROM enrollment
     WHERE offering_id = NEW.offering_id
       AND enrollment_status <> 'Dropped'
       AND enrollment_id <> COALESCE(NEW.enrollment_id, -1);

    IF v_taken >= v_capacity THEN
        RAISE EXCEPTION 'Course offering % is at full capacity (% seats)', NEW.offering_id, v_capacity
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enrollment_capacity
    BEFORE INSERT OR UPDATE OF offering_id, enrollment_status ON enrollment
    FOR EACH ROW EXECUTE FUNCTION fn_enforce_offering_capacity();

-- Capacity can never be reduced below the number of active enrollments.
CREATE OR REPLACE FUNCTION fn_protect_offering_capacity() RETURNS TRIGGER AS $$
DECLARE
    v_taken INTEGER;
BEGIN
    IF NEW.capacity < OLD.capacity THEN
        SELECT COUNT(*) INTO v_taken
          FROM enrollment
         WHERE offering_id = NEW.offering_id
           AND enrollment_status <> 'Dropped';
        IF NEW.capacity < v_taken THEN
            RAISE EXCEPTION 'Capacity % is below the % students already enrolled',
                NEW.capacity, v_taken USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_offering_capacity_reduction
    BEFORE UPDATE OF capacity ON course_offering
    FOR EACH ROW EXECUTE FUNCTION fn_protect_offering_capacity();

-- Keep grade.updated_at accurate without relying on the application.
CREATE OR REPLACE FUNCTION fn_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grade_touch
    BEFORE UPDATE ON grade
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- =============================================================================
-- VIEWS — reusable joins so the API never duplicates academic facts.
-- =============================================================================

-- One row per enrollment with student, course, semester and grade information.
CREATE VIEW v_enrollment_details AS
SELECT e.enrollment_id,
       e.enrollment_date,
       e.enrollment_status,
       s.student_id,
       s.enrollment_number,
       s.first_name || ' ' || s.last_name AS student_name,
       s.email                            AS student_email,
       d.department_code,
       c.course_id,
       c.course_code,
       c.course_name,
       c.credits,
       o.offering_id,
       o.section,
       sm.semester_id,
       sm.semester_name,
       sm.academic_year,
       g.grade_id,
       g.marks_obtained,
       g.max_marks,
       g.grade_letter
  FROM enrollment e
  JOIN student s          ON s.student_id = e.student_id
  LEFT JOIN department d  ON d.department_id = s.department_id
  JOIN course_offering o  ON o.offering_id = e.offering_id
  JOIN course c           ON c.course_id = o.course_id
  JOIN semester sm        ON sm.semester_id = o.semester_id
  LEFT JOIN grade g       ON g.enrollment_id = e.enrollment_id;

-- Capacity utilisation for every offering.
CREATE VIEW v_offering_utilization AS
SELECT o.offering_id,
       c.course_code,
       c.course_name,
       sm.semester_name,
       sm.academic_year,
       o.section,
       o.capacity,
       COUNT(e.enrollment_id) FILTER (WHERE e.enrollment_status <> 'Dropped') AS enrolled,
       ROUND(100.0 * COUNT(e.enrollment_id) FILTER (WHERE e.enrollment_status <> 'Dropped')
             / o.capacity, 1) AS utilisation_percent
  FROM course_offering o
  JOIN course c          ON c.course_id = o.course_id
  JOIN semester sm       ON sm.semester_id = o.semester_id
  LEFT JOIN enrollment e ON e.offering_id = o.offering_id
 GROUP BY o.offering_id, c.course_code, c.course_name, sm.semester_name,
          sm.academic_year, o.section, o.capacity;

-- Per-student credit and grade summary.
CREATE VIEW v_student_academic_summary AS
SELECT s.student_id,
       s.enrollment_number,
       s.first_name || ' ' || s.last_name AS student_name,
       COUNT(DISTINCT e.offering_id) FILTER (WHERE e.enrollment_status <> 'Dropped') AS active_courses,
       COALESCE(SUM(c.credits) FILTER (WHERE e.enrollment_status = 'Completed'), 0) AS credits_completed,
       ROUND(AVG(g.marks_obtained / NULLIF(g.max_marks, 0) * 100), 2) AS average_percentage
  FROM student s
  LEFT JOIN enrollment e     ON e.student_id = s.student_id
  LEFT JOIN course_offering o ON o.offering_id = e.offering_id
  LEFT JOIN course c          ON c.course_id = o.course_id
  LEFT JOIN grade g           ON g.enrollment_id = e.enrollment_id
 GROUP BY s.student_id, s.enrollment_number, s.first_name, s.last_name;

COMMIT;
