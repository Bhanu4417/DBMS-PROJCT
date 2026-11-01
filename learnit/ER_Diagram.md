# Corrected ER diagram

![Corrected ER diagram](ER_Diagram.png)

[Scalable SVG](ER_Diagram.svg) · [Mermaid source](ER_Diagram.mmd)

## Legend and key annotations

`||` = exactly one, `o|`/`|o` = zero or one, `o{` = zero or many. Read each endpoint as how many instances of that entity can relate to one instance at the other end. Thus `DEPARTMENT |o--o{ STUDENT` means a student has 0..1 department and a department has 0..N students.

PK is the chosen candidate key. UK is an alternate candidate key; **when marked CK2 part n, UK denotes membership in a composite UNIQUE constraint, not individual column uniqueness**. CK numbers are local to each entity. All unmarked-nullability attributes are NOT NULL; only attributes labeled nullable permit NULL. Types are logical: SQLite uses INTEGER IDs, REAL marks and flexible date/time affinities; the original PostgreSQL implementation uses SERIAL, NUMERIC and native date/time types.

| Entity | Alternate candidate keys (PK is also a candidate key) |
| --- | --- |
| Department | department_code; department_name |
| Student | enrollment_number; email |
| Faculty | employee_code; email |
| Course | course_code |
| Semester | (semester_name, academic_year) |
| CourseOffering | (course_id, semester_id, section) |
| FacultyAssignment | (faculty_id, offering_id) |
| Enrollment | (student_id, offering_id) |
| Grade | enrollment_id |

## Corrected participation table

“Children per parent” is the parent's participation in this relationship; “parents per child” is the child's participation. Each row is independent.

| Parent → child | Children per parent | Parents per child | Child-side enforcement |
| --- | --- | --- | --- |
| Department → Student | 0..N (partial) | 0..1 (partial) | nullable department_id FK |
| Department → Faculty | 0..N (partial) | 1 (total) | NOT NULL department_id FK |
| Department → Course | 0..N (partial) | 1 (total) | NOT NULL department_id FK |
| Course → CourseOffering | 0..N (partial) | 1 (total) | NOT NULL course_id FK |
| Semester → CourseOffering | 0..N (partial) | 1 (total) | NOT NULL semester_id FK |
| Faculty → FacultyAssignment | 0..N (partial) | 1 (total) | NOT NULL faculty_id FK |
| CourseOffering → FacultyAssignment | 0..N (partial) | 1 (total) | NOT NULL offering_id FK |
| Student → Enrollment | 0..N (partial) | 1 (total) | NOT NULL student_id FK |
| CourseOffering → Enrollment | 0..N (partial) | 1 (total) | NOT NULL offering_id FK |
| Enrollment → Grade | 0..1 (partial) | 1 (total) | UNIQUE NOT NULL enrollment_id FK |

No FK forces a department, course or semester to have children. A NOT NULL FK requires exactly one parent **for an existing child**; it does not require parents to participate. This corrects the old department/faculty/course and semester minima, and the optional student department endpoint.

Faculty–offering and student–offering are M:N relationships resolved by association entities. Their unique pairs prevent duplicate links; timestamps/status/date belong to the links rather than copied parent facts. A separate offering distinguishes course, semester and section. Grade is dependent through its FK, but has its own surrogate identity; it is not a classical weak entity identified by an owner's key plus partial key.

All ten FKs use ON DELETE RESTRICT and ON UPDATE CASCADE. A nullable student department does not imply ON DELETE SET NULL: a referenced department still cannot be deleted. The same student may enroll in distinct sections/terms because the uniqueness rule is student plus offering. Grade letters are independently recorded, not computed from marks.

## Complete attribute diagram

```mermaid
erDiagram
    DEPARTMENT |o--o{ STUDENT : "has"
    DEPARTMENT ||--o{ FACULTY : "employs"
    DEPARTMENT ||--o{ COURSE : "owns"
    COURSE ||--o{ COURSE_OFFERING : "offers"
    SEMESTER ||--o{ COURSE_OFFERING : "schedules"
    FACULTY ||--o{ FACULTY_ASSIGNMENT : "receives"
    COURSE_OFFERING ||--o{ FACULTY_ASSIGNMENT : "has"
    STUDENT ||--o{ ENROLLMENT : "registers"
    COURSE_OFFERING ||--o{ ENROLLMENT : "contains"
    ENROLLMENT ||--o| GRADE : "has"

    DEPARTMENT {
        int department_id PK
        varchar department_code UK "CK2"
        varchar department_name UK "CK3"
        varchar office_location "nullable"
        timestamp created_at "default CURRENT_TIMESTAMP"
    }
    STUDENT {
        int student_id PK
        varchar enrollment_number UK "CK2"
        varchar first_name
        varchar last_name
        varchar email UK "CK3"
        varchar phone "nullable"
        date date_of_birth "nullable"
        varchar gender "nullable"
        int admission_year
        int department_id FK "nullable - DEPARTMENT.department_id"
        varchar status "default Active"
        timestamp created_at "default CURRENT_TIMESTAMP"
    }
    FACULTY {
        int faculty_id PK
        varchar employee_code UK "CK2"
        varchar first_name
        varchar last_name
        varchar email UK "CK3"
        varchar phone "nullable"
        varchar designation "nullable"
        date joining_date "nullable"
        int department_id FK "DEPARTMENT.department_id"
        timestamp created_at "default CURRENT_TIMESTAMP"
    }
    COURSE {
        int course_id PK
        varchar course_code UK "CK2"
        varchar course_name
        int credits "1 to 6"
        int department_id FK "DEPARTMENT.department_id"
        text description "nullable"
    }
    SEMESTER {
        int semester_id PK
        varchar semester_name UK "CK2 part 1 - unique pair only"
        varchar academic_year UK "CK2 part 2 - unique pair only"
        date start_date
        date end_date "later than start_date"
        varchar status "default Upcoming"
    }
    COURSE_OFFERING {
        int offering_id PK
        int course_id FK,UK "COURSE.course_id - CK2 part 1"
        int semester_id FK,UK "SEMESTER.semester_id - CK2 part 2"
        varchar section UK "CK2 part 3 - unique triple only"
        int capacity "positive"
        timestamp created_at "default CURRENT_TIMESTAMP"
    }
    FACULTY_ASSIGNMENT {
        int assignment_id PK
        int faculty_id FK,UK "FACULTY.faculty_id - CK2 part 1"
        int offering_id FK,UK "COURSE_OFFERING.offering_id - CK2 part 2"
        timestamp assigned_at "default CURRENT_TIMESTAMP"
    }
    ENROLLMENT {
        int enrollment_id PK
        int student_id FK,UK "STUDENT.student_id - CK2 part 1"
        int offering_id FK,UK "COURSE_OFFERING.offering_id - CK2 part 2"
        date enrollment_date "default CURRENT_DATE"
        varchar enrollment_status "default Enrolled"
    }
    GRADE {
        int grade_id PK
        int enrollment_id FK,UK "ENROLLMENT.enrollment_id - CK2 single column"
        numeric marks_obtained "nullable - 0 to max_marks"
        numeric max_marks "positive"
        varchar grade_letter "nullable - independently recorded"
        timestamp updated_at "default CURRENT_TIMESTAMP"
    }
```
