"""Readable error translation — never leak database stack traces to clients."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError

CONSTRAINT_MESSAGES: dict[str, str] = {
    # unique
    "uq_student_enrollment_number": "That enrollment number is already used by another student.",
    "uq_student_email": "That email address is already used by another student.",
    "uq_faculty_employee_code": "That employee code is already used by another faculty member.",
    "uq_faculty_email": "That email address is already used by another faculty member.",
    "uq_department_code": "That department code already exists.",
    "uq_department_name": "That department name already exists.",
    "uq_course_code": "That course code already exists.",
    "uq_semester_term": "A semester with that name already exists for this academic year.",
    "uq_offering_course_semester_section": (
        "This course is already offered in that semester with the same section."
    ),
    "uq_assignment_faculty_offering": "That faculty member is already assigned to this offering.",
    "uq_enrollment_student_offering": "This student is already enrolled in this offering.",
    "uq_grade_enrollment": "This enrollment already has a grade record.",
    # foreign keys
    "fk_student_department": "The selected department does not exist.",
    "fk_faculty_department": "The selected department does not exist.",
    "fk_course_department": "The selected department does not exist.",
    "fk_offering_course": "The selected course does not exist.",
    "fk_offering_semester": "The selected semester does not exist.",
    "fk_assignment_faculty": "The selected faculty member does not exist.",
    "fk_assignment_offering": "The selected course offering does not exist.",
    "fk_enrollment_student": "The selected student does not exist.",
    "fk_enrollment_offering": "The selected course offering does not exist.",
    "fk_grade_enrollment": "The selected enrollment does not exist.",
    # checks
    "ck_course_credits": "Course credits must be between 1 and 6.",
    "ck_offering_capacity": "Capacity must be greater than zero.",
    "ck_semester_dates": "The semester end date must be after the start date.",
    "ck_semester_status": "Semester status must be Upcoming, Active or Completed.",
    "ck_enrollment_status": "Enrollment status must be Enrolled, Completed or Dropped.",
    "ck_student_status": "Student status must be Active, Graduated or Inactive.",
    "ck_grade_marks_within_max": "Marks obtained cannot exceed the maximum marks.",
    "ck_grade_marks_non_negative": "Marks cannot be negative.",
    "ck_grade_max_positive": "Maximum marks must be greater than zero.",
    "ck_grade_letter": "Grade letter must be one of A+, A, B+, B, C, D or F.",
    "ck_student_gender": "Gender must be Female, Male, Non-binary or Prefer not to say.",
    "ck_student_admission_year": "Admission year must be between 2000 and 2100.",
}

SQLSTATE_FALLBACK: dict[str, tuple[int, str]] = {
    "23505": (status.HTTP_409_CONFLICT, "A record with those unique details already exists."),
    "23503": (status.HTTP_409_CONFLICT, "A referenced record does not exist."),
    "23514": (status.HTTP_400_BAD_REQUEST, "The submitted values violate a database rule."),
    "23502": (422, "A required field was missing."),
    "23000": (status.HTTP_409_CONFLICT, "The change conflicts with existing data."),
    "40001": (status.HTTP_409_CONFLICT, "The change conflicted with another concurrent change. Please retry."),
}


def _diag(exc: DBAPIError) -> tuple[str | None, str | None, str | None]:
    orig = getattr(exc, "orig", None)
    diagnostics = getattr(orig, "diag", None)
    constraint = getattr(diagnostics, "constraint_name", None)
    message = getattr(diagnostics, "message_primary", None) or str(orig)
    sqlstate = getattr(orig, "sqlstate", None) or getattr(diagnostics, "sqlstate", None)
    return constraint, message, sqlstate


def integrity_error(exc: IntegrityError) -> HTTPException:
    """Convert a database constraint error into a 4xx response with a clear message."""
    constraint, message, sqlstate = _diag(exc)
    if constraint and constraint in CONSTRAINT_MESSAGES:
        return HTTPException(status.HTTP_409_CONFLICT, CONSTRAINT_MESSAGES[constraint])
    # Capacity triggers raise messages that are already human-friendly.
    if message and ("full capacity" in message or "already enrolled" in message):
        return HTTPException(status.HTTP_409_CONFLICT, message)
    if sqlstate in SQLSTATE_FALLBACK:
        code, detail = SQLSTATE_FALLBACK[sqlstate]
        return HTTPException(code, detail)
    return HTTPException(status.HTTP_409_CONFLICT, "The change conflicts with existing data.")


def db_unavailable(exc: Exception) -> HTTPException:
    return HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "The database is unavailable. Check DATABASE_URL and that PostgreSQL is running.",
    )
