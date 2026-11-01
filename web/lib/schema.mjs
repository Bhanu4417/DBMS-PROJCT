export const schema = String.raw`
CREATE TABLE department (
    department_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    department_code VARCHAR(10)  NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    office_location VARCHAR(100),
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_department_code UNIQUE (department_code),
    CONSTRAINT uq_department_name UNIQUE (department_name),
    CONSTRAINT ck_department_code_format CHECK (regexp('^[A-Z]{2,10}$', department_code))
);

CREATE TABLE student (
    student_id        INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT ck_student_email_format CHECK (regexp('^[^@\s]+@[^@\s]+\.[^@\s]+$', email)),
    CONSTRAINT ck_student_phone_format CHECK (phone IS NULL OR regexp('^[0-9+ -]{7,15}$', phone))
);

CREATE TABLE faculty (
    faculty_id    INTEGER PRIMARY KEY AUTOINCREMENT,
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
    CONSTRAINT ck_faculty_email_format CHECK (regexp('^[^@\s]+@[^@\s]+\.[^@\s]+$', email)),
    CONSTRAINT ck_faculty_phone_format CHECK (phone IS NULL OR regexp('^[0-9+ -]{7,15}$', phone)),
    CONSTRAINT ck_faculty_joining_date CHECK (joining_date IS NULL OR joining_date >= '1950-01-01')
);

CREATE TABLE course (
    course_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code   VARCHAR(20)  NOT NULL,
    course_name   VARCHAR(150) NOT NULL,
    credits       INTEGER      NOT NULL,
    department_id INTEGER      NOT NULL,
    description   TEXT,
    CONSTRAINT uq_course_code UNIQUE (course_code),
    CONSTRAINT fk_course_department FOREIGN KEY (department_id)
        REFERENCES department (department_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT ck_course_credits CHECK (credits BETWEEN 1 AND 6),
    CONSTRAINT ck_course_code_format CHECK (regexp('^[A-Z]{2,6}-?[0-9]{3,4}$', course_code))
);

CREATE TABLE semester (
    semester_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    semester_name VARCHAR(50) NOT NULL,
    academic_year VARCHAR(9)  NOT NULL,
    start_date    DATE        NOT NULL,
    end_date      DATE        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'Upcoming',
    CONSTRAINT uq_semester_term UNIQUE (semester_name, academic_year),
    CONSTRAINT ck_semester_status CHECK (status IN ('Upcoming', 'Active', 'Completed')),
    CONSTRAINT ck_semester_dates CHECK (end_date > start_date),
    CONSTRAINT ck_semester_academic_year CHECK (regexp('^[0-9]{4}-[0-9]{4}$', academic_year))
);

CREATE TABLE course_offering (
    offering_id INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE faculty_assignment (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id    INTEGER   NOT NULL,
    offering_id   INTEGER   NOT NULL,
    assigned_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assignment_faculty_offering UNIQUE (faculty_id, offering_id),
    CONSTRAINT fk_assignment_faculty FOREIGN KEY (faculty_id)
        REFERENCES faculty (faculty_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_assignment_offering FOREIGN KEY (offering_id)
        REFERENCES course_offering (offering_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE enrollment (
    enrollment_id     INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE grade (
    grade_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    enrollment_id INTEGER      NOT NULL,
    marks_obtained REAL,
    max_marks     REAL NOT NULL,
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

`;
