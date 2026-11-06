# Portal server integration

`web/lib/portal.mjs` exports `handle(request, service?) -> Promise<Response>` and `initializePortal(db)`. Production uses `api.getService()` returning `{ db, dispatch }`; tests inject an isolated service. Route handlers wrap `handle` (do not pass Next's route context as the service argument).

## Authentication

- `POST /api/auth/login` JSON `{email,password}` returns `{account_id,email,role,student_id}` and an HttpOnly SameSite=Strict session cookie (`Secure` in production). Sessions expire after 8 hours.
- `GET /api/auth/me` returns that account shape; unauthenticated requests return 401.
- `POST /api/auth/logout` revokes the session and clears the cookie. Empty body or `{}` accepted.
- Mutations reject foreign/opaque Origin and cross-site fetch metadata. Same-origin browser requests work normally. CLI clients may omit Origin.
- All API endpoints except GET health and POST login require authentication. Students can only GET `/portal/me`, `/portal/courses`, `/portal/attendance`, `/auth/me`, and POST `/auth/logout`.
- Demo admin: `admin@campus.local` / `CampusAdmin!2026`.
- Demo student: `student1@campus.edu.in` / `CampusStudent!2026` (student ID 1; email comes from the existing student row).
- `POST /api/admin/accounts` accepts ONLY `{student_id,password}` (12–256 characters). Email comes from the student record; role is always student. Returns account shape, 201; existing accounts return 409. This is provisioning, not password reset.

## Student response shapes

All student queries use the account's linked student ID and ignore client IDs.

- `/portal/me`: student row plus `department_name,department_code`.
- `/portal/courses`: array of enrollment rows plus `course_code,course_name,credits,section,semester_name,academic_year,marks_obtained,max_marks,grade_letter`.
- `/portal/attendance`: array of `attendance_id,enrollment_id,date,status,course_code,course_name`.

## Admin resources

`/api/attendance` supports list/detail GET, collection POST, detail PUT/DELETE. Lists return `{items,total,page,page_size,pages}` (default 20, maximum 200). PUT is partial. DELETE returns `{detail}`. Attendance uses `attendance_id`.

- Attendance fields: `enrollment_id,date,status`; statuses `Present|Absent|Late|Excused`. Unique enrollment/date. Use original `/api/enrollments/options` for dropdowns.
- Original admin APIs and CSV/SQL export response headers/bodies are preserved. SQL export remains admin-only.
- Validation 422, duplicate/FK 409, malformed JSON 400, unavailable DB 503, generic internal errors 500. No exception text is exposed.

## SQL audit contract

`web/lib/sql-audit.mjs` exports `recordSql(sql, duration, rows)`, `withSqlAudit(meta, fn)`, `getSqlAudit()`. Instrument db.prepare statement methods and db.exec in `api.mjs`; pass SQL templates, duration in milliseconds and result row/change count. No values, parameters, errors or credentials should be passed. Calls outside an audit context are ignored. Auth/account/session/throttle statements are excluded; string and numeric literals are redacted. Up to 200 events are kept in process memory.

Admin `GET /api/dbviewer` returns `{items,limit:200}`. Event keys: `id,request_id,timestamp,method,path,role,account_id,student_id,sql,duration_ms,rows,success`. Path excludes query strings. `success` reflects final HTTP status (can be null while a request is in progress). Returned copies cannot mutate stored events.

The retired Library feature is removed at startup: legacy `library_loan` and `library_book` tables are dropped in a transaction; other academic, account, attendance, and EER records are preserved. SQL export excludes authentication data and includes attendance/EER records.

Run: `node --test web/tests/api.test.mjs web/tests/portal.test.mjs` from workspace root (or `node --test tests/*.test.mjs` from web).
