"""Dashboard aggregations — every number comes from a live SQL query."""
from __future__ import annotations

from sqlalchemy import desc, func, literal, select
from sqlalchemy.orm import Session

from app.models.entities import (
    Course,
    CourseOffering,
    Department,
    Enrollment,
    Faculty,
    Grade,
    Semester,
    Student,
)


def stats(db: Session) -> dict:
    def count(model) -> int:
        return db.scalar(select(func.count()).select_from(model)) or 0

    return {
        "total_students": count(Student),
        "total_faculty": count(Faculty),
        "total_departments": count(Department),
        "total_courses": count(Course),
        "total_offerings": count(CourseOffering),
        "total_enrollments": count(Enrollment),
        "total_grades": count(Grade),
        "active_enrollments": db.scalar(
            select(func.count()).select_from(Enrollment).where(Enrollment.enrollment_status == "Enrolled")
        ) or 0,
        "active_semesters": db.scalar(
            select(func.count()).select_from(Semester).where(Semester.status == "Active")
        ) or 0,
    }


def charts(db: Session) -> dict:
    students_by_department = db.execute(
        select(
            Department.department_code.label("name"),
            Department.department_name.label("full_name"),
            func.count(Student.student_id).label("value"),
        )
        .select_from(Department)
        .outerjoin(Student, Student.department_id == Department.department_id)
        .group_by(Department.department_id)
        .order_by(Department.department_code)
    ).mappings().all()

    admissions_by_year = db.execute(
        select(Student.admission_year.label("year"), func.count().label("value"))
        .group_by(Student.admission_year)
        .order_by(Student.admission_year)
    ).mappings().all()

    enrollment_distribution = db.execute(
        select(Enrollment.enrollment_status.label("name"), func.count().label("value"))
        .group_by(Enrollment.enrollment_status)
        .order_by(Enrollment.enrollment_status)
    ).mappings().all()

    offerings_by_semester = db.execute(
        select(
            (Semester.semester_name + literal(" ") + Semester.academic_year).label("name"),
            func.count(CourseOffering.offering_id).label("value"),
        )
        .select_from(Semester)
        .outerjoin(CourseOffering, CourseOffering.semester_id == Semester.semester_id)
        .group_by(Semester.semester_id)
        .order_by(Semester.start_date)
    ).mappings().all()

    return {
        "students_by_department": [dict(row) for row in students_by_department],
        "admissions_by_year": [dict(row) for row in admissions_by_year],
        "enrollment_distribution": [dict(row) for row in enrollment_distribution],
        "offerings_by_semester": [dict(row) for row in offerings_by_semester],
    }


def recent_students(db: Session, limit: int = 5) -> list[dict]:
    rows = db.execute(
        select(
            Student.student_id,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Student.enrollment_number,
            Department.department_name,
            Student.admission_year,
            Student.status,
            Student.created_at,
        )
        .outerjoin(Department, Department.department_id == Student.department_id)
        .order_by(Student.student_id.desc())
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def recent_enrollments(db: Session, limit: int = 5) -> list[dict]:
    rows = db.execute(
        select(
            Enrollment.enrollment_id,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Course.course_code,
            Course.course_name,
            Enrollment.enrollment_date,
            Enrollment.enrollment_status,
        )
        .select_from(Enrollment)
        .join(Student, Student.student_id == Enrollment.student_id)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .order_by(Enrollment.enrollment_id.desc())
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def popular_courses(db: Session, limit: int = 5) -> list[dict]:
    enrolled = (
        select(func.count(Enrollment.enrollment_id))
        .select_from(Enrollment)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .where(
            CourseOffering.course_id == Course.course_id,
            Enrollment.enrollment_status != "Dropped",
        )
        .correlate(Course)
        .scalar_subquery()
    )
    rows = db.execute(
        select(
            Course.course_id,
            Course.course_code,
            Course.course_name,
            Department.department_code,
            enrolled.label("enrolled"),
        )
        .select_from(Course)
        .join(Department, Department.department_id == Course.department_id)
        .order_by(desc(enrolled))
        .limit(limit)
    ).mappings().all()
    return [dict(row) for row in rows]


def department_overview(db: Session) -> list[dict]:
    student_count = (
        select(func.count(Student.student_id))
        .where(Student.department_id == Department.department_id)
        .correlate(Department)
        .scalar_subquery()
    )
    faculty_count = (
        select(func.count(Faculty.faculty_id))
        .where(Faculty.department_id == Department.department_id)
        .correlate(Department)
        .scalar_subquery()
    )
    course_count = (
        select(func.count(Course.course_id))
        .where(Course.department_id == Department.department_id)
        .correlate(Department)
        .scalar_subquery()
    )
    rows = db.execute(
        select(
            Department.department_id,
            Department.department_code,
            Department.department_name,
            Department.office_location,
            student_count.label("students"),
            faculty_count.label("faculty"),
            course_count.label("courses"),
        ).order_by(Department.department_code)
    ).mappings().all()
    return [dict(row) for row in rows]
