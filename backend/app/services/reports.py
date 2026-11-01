"""Report queries used by the Reports page and the CSV export endpoint."""
from __future__ import annotations

from sqlalchemy import Numeric, cast, func, literal, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Course,
    CourseOffering,
    Department,
    Enrollment,
    Faculty,
    FacultyAssignment,
    Grade,
    Semester,
    Student,
)

REPORTS: dict[str, dict] = {
    "students-by-department": {
        "title": "Students by department",
        "columns": ["department_code", "department_name", "students"],
    },
    "students-by-year": {
        "title": "Students by admission year",
        "columns": ["admission_year", "students"],
    },
    "students-by-status": {
        "title": "Active vs inactive students",
        "columns": ["status", "students"],
    },
    "faculty-by-department": {
        "title": "Faculty by department",
        "columns": ["department_code", "department_name", "faculty"],
    },
    "faculty-assignments": {
        "title": "Faculty course assignments",
        "columns": [
            "employee_code", "faculty_name", "department_name", "course_code", "course_name",
            "semester_name", "academic_year", "section",
        ],
    },
    "course-enrollment": {
        "title": "Course enrollment counts",
        "columns": ["course_code", "course_name", "offerings", "enrolled"],
    },
    "capacity-utilization": {
        "title": "Course capacity utilisation",
        "columns": [
            "course_code", "course_name", "semester_name", "academic_year", "section",
            "capacity", "enrolled", "utilisation_percent",
        ],
    },
    "grade-report": {
        "title": "Student grade report",
        "columns": [
            "enrollment_number", "student_name", "course_code", "course_name",
            "semester_name", "academic_year", "marks_obtained", "max_marks",
            "grade_letter", "percentage",
        ],
    },
    "semester-summary": {
        "title": "Semester enrollment summary",
        "columns": [
            "semester_name", "academic_year", "status", "offerings", "enrollments", "students",
        ],
    },
}


def _rows(db: Session, key: str) -> list[dict]:
    if key == "students-by-department":
        stmt = (
            select(
                Department.department_code,
                Department.department_name,
                func.count(Student.student_id).label("students"),
            )
            .select_from(Department)
            .outerjoin(Student, Student.department_id == Department.department_id)
            .group_by(Department.department_id)
            .order_by(Department.department_code)
        )
    elif key == "students-by-year":
        stmt = (
            select(Student.admission_year, func.count().label("students"))
            .group_by(Student.admission_year)
            .order_by(Student.admission_year)
        )
    elif key == "students-by-status":
        stmt = (
            select(Student.status, func.count().label("students"))
            .group_by(Student.status)
            .order_by(Student.status)
        )
    elif key == "faculty-by-department":
        stmt = (
            select(
                Department.department_code,
                Department.department_name,
                func.count(Faculty.faculty_id).label("faculty"),
            )
            .select_from(Department)
            .outerjoin(Faculty, Faculty.department_id == Department.department_id)
            .group_by(Department.department_id)
            .order_by(Department.department_code)
        )
    elif key == "faculty-assignments":
        stmt = (
            select(
                Faculty.employee_code,
                (Faculty.first_name + literal(" ") + Faculty.last_name).label("faculty_name"),
                Department.department_name,
                Course.course_code,
                Course.course_name,
                Semester.semester_name,
                Semester.academic_year,
                CourseOffering.section,
            )
            .select_from(FacultyAssignment)
            .join(Faculty, Faculty.faculty_id == FacultyAssignment.faculty_id)
            .join(Department, Department.department_id == Faculty.department_id)
            .join(CourseOffering, CourseOffering.offering_id == FacultyAssignment.offering_id)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .join(Semester, Semester.semester_id == CourseOffering.semester_id)
            .order_by(Faculty.employee_code)
        )
    elif key == "course-enrollment":
        stmt = (
            select(
                Course.course_code,
                Course.course_name,
                func.count(func.distinct(CourseOffering.offering_id)).label("offerings"),
                func.count(Enrollment.enrollment_id).label("enrolled"),
            )
            .select_from(Course)
            .outerjoin(CourseOffering, CourseOffering.course_id == Course.course_id)
            .outerjoin(
                Enrollment,
                (Enrollment.offering_id == CourseOffering.offering_id)
                & (Enrollment.enrollment_status != "Dropped"),
            )
            .group_by(Course.course_id)
            .order_by(func.count(Enrollment.enrollment_id).desc(), Course.course_code)
        )
    elif key == "capacity-utilization":
        enrolled = func.count(Enrollment.enrollment_id).filter(Enrollment.enrollment_status != "Dropped")
        stmt = (
            select(
                Course.course_code,
                Course.course_name,
                Semester.semester_name,
                Semester.academic_year,
                CourseOffering.section,
                CourseOffering.capacity,
                enrolled.label("enrolled"),
                func.round(cast(enrolled * 100.0, Numeric) / CourseOffering.capacity, 1).label(
                    "utilisation_percent"
                ),
            )
            .select_from(CourseOffering)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .join(Semester, Semester.semester_id == CourseOffering.semester_id)
            .outerjoin(Enrollment, Enrollment.offering_id == CourseOffering.offering_id)
            .group_by(CourseOffering.offering_id, Course.course_code, Course.course_name,
                      Semester.semester_name, Semester.academic_year, CourseOffering.section,
                      CourseOffering.capacity)
            .order_by(Course.course_code)
        )
    elif key == "grade-report":
        stmt = (
            select(
                Student.enrollment_number,
                (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
                Course.course_code,
                Course.course_name,
                Semester.semester_name,
                Semester.academic_year,
                Grade.marks_obtained,
                Grade.max_marks,
                Grade.grade_letter,
                func.round(Grade.marks_obtained / func.nullif(Grade.max_marks, 0) * 100, 2).label(
                    "percentage"
                ),
            )
            .select_from(Grade)
            .join(Enrollment, Enrollment.enrollment_id == Grade.enrollment_id)
            .join(Student, Student.student_id == Enrollment.student_id)
            .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
            .join(Course, Course.course_id == CourseOffering.course_id)
            .join(Semester, Semester.semester_id == CourseOffering.semester_id)
            .order_by(Student.enrollment_number, Course.course_code)
        )
    elif key == "semester-summary":
        stmt = (
            select(
                Semester.semester_name,
                Semester.academic_year,
                Semester.status,
                func.count(func.distinct(CourseOffering.offering_id)).label("offerings"),
                func.count(Enrollment.enrollment_id).label("enrollments"),
                func.count(func.distinct(Enrollment.student_id)).label("students"),
            )
            .select_from(Semester)
            .outerjoin(CourseOffering, CourseOffering.semester_id == Semester.semester_id)
            .outerjoin(Enrollment, Enrollment.offering_id == CourseOffering.offering_id)
            .group_by(Semester.semester_id)
            .order_by(Semester.start_date)
        )
    else:
        raise KeyError(key)

    return [dict(row) for row in db.execute(stmt).mappings().all()]


def students_report(db: Session) -> dict:
    return {
        "by_department": _rows(db, "students-by-department"),
        "by_admission_year": _rows(db, "students-by-year"),
        "by_status": _rows(db, "students-by-status"),
    }


def faculty_report(db: Session) -> dict:
    return {
        "by_department": _rows(db, "faculty-by-department"),
        "assignments": _rows(db, "faculty-assignments"),
    }


def academic_report(db: Session) -> dict:
    return {
        "course_enrollment": _rows(db, "course-enrollment"),
        "capacity_utilization": _rows(db, "capacity-utilization"),
        "grade_distribution": grade_distribution(db),
        "semester_summary": _rows(db, "semester-summary"),
        "student_grades": _rows(db, "grade-report"),
    }


def grade_distribution(db: Session) -> list[dict]:
    rows = db.execute(
        select(Grade.grade_letter.label("name"), func.count().label("value"))
        .where(Grade.grade_letter.is_not(None))
        .group_by(Grade.grade_letter)
        .order_by(Grade.grade_letter)
    ).mappings().all()
    return [dict(row) for row in rows]


def report_rows(db: Session, key: str) -> list[dict]:
    if key not in REPORTS:
        raise KeyError(key)
    return _rows(db, key)
