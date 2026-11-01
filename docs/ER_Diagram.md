# Entity Relationship Diagram — CampusOS

The full diagram is available in three forms:

| File | Purpose |
| --- | --- |
| `docs/ER_Diagram.png` | Rendered diagram (4898 × 6000 px, dark theme) — use this in the report/viva |
| `docs/ER_Diagram.mmd` | Mermaid source that produced the PNG |
| `docs/ER_Diagram.md` | This file: diagram plus the participation constraints in words |

Regenerate the PNG after editing the source:

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i docs/ER_Diagram.mmd -o docs/ER_Diagram.png -t dark --size 3000 -b "#0B0F19"
```

## Legend

- `PK` primary key, `UK` unique (candidate) key, `FK` foreign key
- `||--o{` one-to-zero-or-many, `||--|{` one-to-one-or-many, `||--o|` one-to-zero-or-one
- Crow's foot on the right-hand side is the "many" end
- Participation is written as `(min..max)` on each relationship label
- `NOT NULL` in an attribute description means the relationship is mandatory in SQL

```mermaid
erDiagram
    DEPARTMENT ||--o{ STUDENT : "enrols (0..N)"
    DEPARTMENT ||--|{ FACULTY : "employs (1..N)"
    DEPARTMENT ||--|{ COURSE : "owns (1..N)"
    COURSE ||--o{ COURSE_OFFERING : "is offered as (1..N)"
    SEMESTER ||--|{ COURSE_OFFERING : "schedules (1..N)"
    FACULTY ||--o{ FACULTY_ASSIGNMENT : "receives (0..N)"
    COURSE_OFFERING ||--o{ FACULTY_ASSIGNMENT : "has (0..N)"
    STUDENT ||--o{ ENROLLMENT : "registers (0..N)"
    COURSE_OFFERING ||--o{ ENROLLMENT : "contains (0..N)"
    ENROLLMENT ||--o| GRADE : "achieves (0..1)"

    DEPARTMENT {
        int department_id PK "surrogate key"
        varchar department_code UK "CSE, ECE ..."
        varchar department_name UK
        varchar office_location "nullable"
        timestamp created_at "default now()"
    }

    STUDENT {
        int student_id PK
        varchar enrollment_number UK "unique"
        varchar first_name
        varchar last_name
        varchar email UK "unique"
        varchar phone "nullable, 7-15 chars"
        date date_of_birth "nullable"
        varchar gender "Female|Male|Non-binary|Prefer not to say"
        int admission_year "2000-2100"
        int department_id FK "nullable -> DEPARTMENT"
        varchar status "Active|Graduated|Inactive"
        timestamp created_at
    }

    FACULTY {
        int faculty_id PK
        varchar employee_code UK "unique"
        varchar first_name
        varchar last_name
        varchar email UK "unique"
        varchar phone "nullable"
        varchar designation "nullable"
        date joining_date "nullable"
        int department_id FK "NOT NULL -> DEPARTMENT"
        timestamp created_at
    }

    COURSE {
        int course_id PK
        varchar course_code UK "unique, e.g. CSE-301"
        varchar course_name
        int credits "CHECK 1..6"
        int department_id FK "NOT NULL -> DEPARTMENT"
        text description "nullable"
    }

    SEMESTER {
        int semester_id PK
        varchar semester_name
        varchar academic_year "format YYYY-YYYY"
        date start_date
        date end_date "CHECK end > start"
        varchar status "Upcoming|Active|Completed"
    }

    COURSE_OFFERING {
        int offering_id PK
        int course_id FK "NOT NULL -> COURSE"
        int semester_id FK "NOT NULL -> SEMESTER"
        varchar section
        int capacity "CHECK > 0"
        timestamp created_at
    }

    FACULTY_ASSIGNMENT {
        int assignment_id PK
        int faculty_id FK "NOT NULL -> FACULTY"
        int offering_id FK "NOT NULL -> COURSE_OFFERING"
        timestamp assigned_at
    }

    ENROLLMENT {
        int enrollment_id PK
        int student_id FK "NOT NULL -> STUDENT"
        int offering_id FK "NOT NULL -> COURSE_OFFERING"
        date enrollment_date "default CURRENT_DATE"
        varchar enrollment_status "Enrolled|Completed|Dropped"
    }

    GRADE {
        int grade_id PK
        int enrollment_id FK "UNIQUE, NOT NULL -> ENROLLMENT"
        numeric marks_obtained "CHECK 0..max_marks"
        numeric max_marks "CHECK > 0"
        varchar grade_letter "A+|A|B+|B|C|D|F"
        timestamp updated_at
    }
```

## Participation constraints at a glance

| Relationship | Parent participation | Child participation | Enforced by |
| --- | --- | --- | --- |
| Department → Student | Optional: a department may have zero students | Optional: `student.department_id` is nullable | Query in `schema.sql`; nullable FK |
| Department → Faculty | Optional: a new department may have no staff yet | **Mandatory**: every faculty belongs to exactly one department | `faculty.department_id NOT NULL` |
| Department → Course | Optional: a department may own zero courses | **Mandatory**: every course belongs to one department | `course.department_id NOT NULL` |
| Course → CourseOffering | Optional: a course may never be offered | **Mandatory**: each offering references one course | `course_offering.course_id NOT NULL` |
| Semester → CourseOffering | Optional: a semester may have no offerings | **Mandatory**: each offering belongs to one semester | `course_offering.semester_id NOT NULL` |
| Faculty ↔ CourseOffering | Optional on both sides (a faculty member may teach nothing; an offering may have no teacher assigned yet) | Each assignment row is mandatory for both sides | `faculty_assignment` with `NOT NULL` FKs + unique pair |
| Student ↔ CourseOffering | Optional on both sides | Each enrollment row is mandatory for both sides | `enrollment` with `NOT NULL` FKs + unique pair |
| Enrollment → Grade | Optional: an enrollment may exist without a grade | **Mandatory**: every grade references exactly one enrollment | `grade.enrollment_id NOT NULL UNIQUE` |

Every many-to-many relationship is resolved by an association table
(`faculty_assignment`, `enrollment`), so no repeating groups or array columns exist
anywhere in the schema.
