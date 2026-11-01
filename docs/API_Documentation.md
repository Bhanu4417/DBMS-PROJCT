# API Documentation — CampusOS

Base URL: `http://localhost:8000/api`
Interactive reference (Swagger UI): `http://localhost:8000/docs`
OpenAPI JSON: `http://localhost:8000/openapi.json`

All requests and responses are JSON. Every collection endpoint returns the same
envelope, so the frontend can reuse one table component:

```json
{
  "items": [ ... ],
  "total": 50,
  "page": 1,
  "page_size": 10,
  "pages": 5
}
```

## Conventions

| Item | Meaning |
| --- | --- |
| `GET /resource` | Paginated list |
| `GET /resource/options` | Lightweight `{value, label}` list for dropdowns |
| `GET /resource/{id}` | One record (with joined details where relevant) |
| `POST /resource` | Create (201) |
| `PUT /resource/{id}` | Partial update (200) |
| `DELETE /resource/{id}` | Delete, or 409 when dependent records exist (200 + `{detail}`) |

Common query parameters on list endpoints:

| Parameter | Type | Default | Notes |
| --- | --- | --- | --- |
| `search` | string | – | Case-insensitive search on the resource's meaningful columns |
| `sort_by` | string | resource-specific | Whitelisted column keys only |
| `sort_dir` | `asc` \| `desc` | `asc` | |
| `page` | int ≥ 1 | 1 | |
| `page_size` | int 1–200 | 10 | |

### HTTP status codes

| Code | When |
| --- | --- |
| 200 | Successful read/update/delete |
| 201 | Record created |
| 404 | The id (or a referenced foreign key) does not exist |
| 409 | Unique, foreign-key or capacity rule violated; message explains which |
| 422 | Request body failed validation; includes a field-level `errors` array |
| 503 | PostgreSQL unreachable (`DATABASE_URL` wrong or server down) |
| 500 | Unexpected error — the response never contains a stack trace |

Validation error shape:

```json
{
  "detail": "Please correct the highlighted fields.",
  "errors": [
    { "field": "credits", "message": "Input should be less than or equal to 6" }
  ]
}
```

---

## System

### `GET /api/health`
```json
{"status": "ok", "database": "connected", "postgres_version": "16.15"}
```
Returns `503` with `{"status": "degraded", "database": "unavailable"}` when the
database is down.

---

## Students — `/api/students`

| Method & path | Description |
| --- | --- |
| `GET /api/students` | List with `search`, `department_id`, `status`, `admission_year`, `sort_by` (`name`, `last_name`, `admission_year`, `enrollment_number`, `status`), `sort_dir`, `page`, `page_size` |
| `GET /api/students/options` | `[{value, label}]` for enrollment forms (`?search=` supported) |
| `GET /api/students/{id}` | Student + department name + **enrollment history** (course, semester, credits, marks, grade) |
| `POST /api/students` | Create |
| `PUT /api/students/{id}` | Update any subset of fields |
| `DELETE /api/students/{id}` | Delete when the student has no enrollments (otherwise 409) |

Create body (required fields marked ✱):

```json
{
  "enrollment_number": "ENR2025001",
  "first_name": "Aarav",
  "last_name": "Sharma",
  "email": "aarav.sharma@college.edu.in",
  "phone": "9876543210",
  "date_of_birth": "2006-04-12",
  "gender": "Male",
  "admission_year": 2025,
  "department_id": 1,
  "status": "Active"
}
```

Rules: `enrollment_number` ✱ unique, `email` ✱ unique and valid, `admission_year` ✱
2000–2100, `status` ∈ {Active, Graduated, Inactive}, `gender` ∈ {Female, Male,
Non-binary, Prefer not to say} or null, `department_id` must exist.

Example list item:

```json
{
  "student_id": 1,
  "enrollment_number": "ENR202101001",
  "first_name": "Arjun",
  "last_name": "Menon",
  "full_name": "Arjun Menon",
  "email": "arjun.menon1@student.college.edu.in",
  "admission_year": 2021,
  "department_id": 1,
  "department_name": "Computer Science and Engineering",
  "status": "Graduated",
  "enrollment_count": 2
}
```

---

## Faculty — `/api/faculty`

| Method & path | Description |
| --- | --- |
| `GET /api/faculty` | Filters: `search`, `department_id`, `designation`; sorts: `name`, `designation`, `employee_code` |
| `GET /api/faculty/options` | Dropdown source |
| `GET /api/faculty/{id}` | Faculty + assigned course offerings |
| `POST` / `PUT` / `DELETE` | CRUD; delete blocked (409) while assignments exist |

Body: `employee_code` ✱ unique, `first_name` ✱, `last_name` ✱, `email` ✱ unique,
`phone`, `designation`, `joining_date`, `department_id` ✱.

---

## Departments — `/api/departments`

| Method & path | Description |
| --- | --- |
| `GET /api/departments` | `search`, `sort_by` (`code`, `name`); each row carries `student_count`, `faculty_count`, `course_count` computed by SQL |
| `GET /api/departments/options` | Dropdown source |
| `GET /api/departments/{id}` | Single department |
| `POST` / `PUT` / `DELETE` | CRUD; delete blocked while students/faculty/courses reference it |

Body: `department_code` ✱ (2–10 uppercase letters), `department_name` ✱ unique,
`office_location`.

---

## Courses — `/api/courses`

| Method & path | Description |
| --- | --- |
| `GET /api/courses` | `search`, `department_id`, `min_credits`; sorts `code`, `name`, `credits` |
| `GET /api/courses/options` | Dropdown source |
| `GET /api/courses/{id}` | Course + its offerings (semester, section, capacity, enrolled) |
| `POST` / `PUT` / `DELETE` | CRUD; delete blocked while offerings exist |

Body: `course_code` ✱ (`CSE-301` pattern, unique), `course_name` ✱, `credits` ✱ 1–6,
`department_id` ✱, `description`.

---

## Semesters — `/api/semesters`

| Method & path | Description |
| --- | --- |
| `GET /api/semesters` | `search`, `status`, `academic_year`; sorts `start`, `name`, `status` |
| `GET /api/semesters/options` | Dropdown source with status in `meta` |
| `GET /api/semesters/{id}` | Single semester |
| `GET /api/semesters/{id}/offerings` | Offerings created in that semester |
| `POST` / `PUT` / `DELETE` | CRUD; `end_date` must be after `start_date`; delete blocked while offerings exist |

Body: `semester_name` ✱, `academic_year` ✱ (`YYYY-YYYY`), `start_date` ✱,
`end_date` ✱, `status` ✱ ∈ {Upcoming, Active, Completed}. The pair
(`semester_name`, `academic_year`) is unique.

---

## Course offerings — `/api/offerings`

| Method & path | Description |
| --- | --- |
| `GET /api/offerings` | `search`, `course_id`, `semester_id`, `section`; sorts `course`, `semester`, `capacity` |
| `GET /api/offerings/options` | Dropdown labels include free seats |
| `GET /api/offerings/{id}` | Offering + **enrolled students** + **assigned faculty** + seats left |
| `POST` / `PUT` / `DELETE` | CRUD; (`course_id`, `semester_id`, `section`) unique; capacity > 0 |

`PUT` with a smaller `capacity` is rejected (409) if students are already enrolled
above the new limit.

---

## Faculty assignments — `/api/assignments`

| Method & path | Description |
| --- | --- |
| `GET /api/assignments` | `search`, `faculty_id`, `offering_id`, `semester_id`, `department_id` |
| `GET /api/assignments/{id}` | One assignment with joined faculty/course names |
| `POST` / `PUT` / `DELETE` | CRUD; (`faculty_id`, `offering_id`) unique |

Body: `faculty_id` ✱, `offering_id` ✱.

---

## Enrollments — `/api/enrollments`

| Method & path | Description |
| --- | --- |
| `GET /api/enrollments` | `search`, `student_id`, `offering_id`, `course_id`, `semester_id`, `enrollment_status`, `has_grade` |
| `GET /api/enrollments/options?ungraded=true` | Dropdown of enrollments that have no grade yet |
| `GET /api/enrollments/{id}` | One enrollment with student, course, semester and grade |
| `POST /api/enrollments` | Transactional enrollment (see below) |
| `PUT /api/enrollments/{id}` | Change `enrollment_status` and/or `enrollment_date` |
| `DELETE /api/enrollments/{id}` | Blocked (409) when a grade exists |

Enrollment algorithm (inside one transaction):

1. Verify the student exists → 404.
2. `SELECT … FROM course_offering WHERE offering_id = ? FOR UPDATE` — locks the row.
3. Reject duplicates → 409 "This student is already enrolled in this course offering."
4. Count active enrollments; reject when `count >= capacity` → 409 "This offering is
   full: 2 of 2 seats are taken."
5. Insert and commit. The database trigger repeats the check as a second line of
   defence.

Re-activating a `Dropped` enrollment takes the same lock and re-checks capacity.

```json
{ "student_id": 4, "offering_id": 12, "enrollment_status": "Enrolled" }
```

---

## Grades — `/api/grades`

| Method & path | Description |
| --- | --- |
| `GET /api/grades` | `search`, `course_id`, `semester_id`, `grade_letter`; sorts `student`, `course`, `marks` |
| `GET /api/grades/{id}` | One grade with student/course names and percentage |
| `POST` / `PUT` / `DELETE` | CRUD; one grade per enrollment (409 otherwise) |

Body: `enrollment_id` ✱, `marks_obtained` (≥ 0, ≤ max), `max_marks` ✱ (> 0),
`grade_letter` ∈ {A+, A, B+, B, C, D, F} or null.

---

## Dashboard

| Endpoint | Returns |
| --- | --- |
| `GET /api/dashboard/stats` | `total_students`, `total_faculty`, `total_departments`, `total_courses`, `total_offerings`, `total_enrollments`, `total_grades`, `active_enrollments`, `active_semesters` |
| `GET /api/dashboard/charts` | `students_by_department`, `admissions_by_year`, `enrollment_distribution`, `offerings_by_semester` — arrays of `{name, value}` (admissions uses `{year, value}`) |
| `GET /api/dashboard/activity?limit=5` | `recent_students`, `recent_enrollments`, `popular_courses`, `department_overview` |

Every value is produced by a live query — nothing is cached or hard-coded.

---

## Reports

| Endpoint | Sections returned |
| --- | --- |
| `GET /api/reports` | Catalogue of exportable report keys and columns |
| `GET /api/reports/students` | `by_department`, `by_admission_year`, `by_status` |
| `GET /api/reports/faculty` | `by_department`, `assignments` |
| `GET /api/reports/academic` | `course_enrollment`, `capacity_utilization`, `grade_distribution`, `semester_summary`, `student_grades` |
| `GET /api/reports/export?report=<key>` | CSV download (`Content-Disposition: attachment`) |

Report keys: `students-by-department`, `students-by-year`, `students-by-status`,
`faculty-by-department`, `faculty-assignments`, `course-enrollment`,
`capacity-utilization`, `grade-report`, `semester-summary`.

---

## Quick reference (all routes)

```
GET    /api/health
GET    /api/dashboard/stats
GET    /api/dashboard/charts
GET    /api/dashboard/activity

GET    /api/students            POST   /api/students
GET    /api/students/options
GET    /api/students/{id}       PUT    /api/students/{id}      DELETE /api/students/{id}

GET    /api/faculty             POST   /api/faculty
GET    /api/faculty/options
GET    /api/faculty/{id}        PUT    /api/faculty/{id}       DELETE /api/faculty/{id}

GET    /api/departments         POST   /api/departments
GET    /api/departments/options
GET    /api/departments/{id}    PUT    /api/departments/{id}   DELETE /api/departments/{id}

GET    /api/courses             POST   /api/courses
GET    /api/courses/options
GET    /api/courses/{id}        PUT    /api/courses/{id}       DELETE /api/courses/{id}

GET    /api/semesters           POST   /api/semesters
GET    /api/semesters/options
GET    /api/semesters/{id}      PUT    /api/semesters/{id}     DELETE /api/semesters/{id}
GET    /api/semesters/{id}/offerings

GET    /api/offerings           POST   /api/offerings
GET    /api/offerings/options
GET    /api/offerings/{id}      PUT    /api/offerings/{id}     DELETE /api/offerings/{id}

GET    /api/assignments         POST   /api/assignments
GET    /api/assignments/{id}    PUT    /api/assignments/{id}   DELETE /api/assignments/{id}

GET    /api/enrollments         POST   /api/enrollments
GET    /api/enrollments/options
GET    /api/enrollments/{id}    PUT    /api/enrollments/{id}   DELETE /api/enrollments/{id}

GET    /api/grades              POST   /api/grades
GET    /api/grades/{id}         PUT    /api/grades/{id}        DELETE /api/grades/{id}

GET    /api/reports
GET    /api/reports/students
GET    /api/reports/faculty
GET    /api/reports/academic
GET    /api/reports/export?report=<key>
```

## curl examples

```bash
# List students of department 1, newest admissions first
curl "http://localhost:8000/api/students?department_id=1&sort_by=admission_year&sort_dir=desc"

# Create a student
curl -X POST http://localhost:8000/api/students \
  -H 'Content-Type: application/json' \
  -d '{"enrollment_number":"ENR2025100","first_name":"New","last_name":"Student",
       "email":"new.student@college.edu.in","admission_year":2025,"department_id":1}'

# Download a CSV report
curl -O -J "http://localhost:8000/api/reports/export?report=grade-report"

# Enroll a student (409 when the offering is full)
curl -X POST http://localhost:8000/api/enrollments \
  -H 'Content-Type: application/json' \
  -d '{"student_id":10,"offering_id":12}'
```
