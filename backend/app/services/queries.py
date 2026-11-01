"""Reusable joined queries — academic facts are read through SQL joins, never copied."""
from __future__ import annotations

from sqlalchemy import Select, and_, func, literal, select

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

student_enrollment_count = (
    select(func.count(Enrollment.enrollment_id))
    .where(Enrollment.student_id == Student.student_id)
    .correlate(Student)
    .scalar_subquery()
)

faculty_assignment_count = (
    select(func.count(FacultyAssignment.assignment_id))
    .where(FacultyAssignment.faculty_id == Faculty.faculty_id)
    .correlate(Faculty)
    .scalar_subquery()
)

course_offering_count = (
    select(func.count(CourseOffering.offering_id))
    .where(CourseOffering.course_id == Course.course_id)
    .correlate(Course)
    .scalar_subquery()
)

semester_offering_count = (
    select(func.count(CourseOffering.offering_id))
    .where(CourseOffering.semester_id == Semester.semester_id)
    .correlate(Semester)
    .scalar_subquery()
)

offering_enrolled_count = (
    select(func.count(Enrollment.enrollment_id))
    .where(
        and_(
            Enrollment.offering_id == CourseOffering.offering_id,
            Enrollment.enrollment_status != "Dropped",
        )
    )
    .correlate(CourseOffering)
    .scalar_subquery()
)

offering_faculty_names = (
    select(func.string_agg(Faculty.first_name + literal(" ") + Faculty.last_name, ", "))
    .select_from(FacultyAssignment)
    .join(Faculty, Faculty.faculty_id == FacultyAssignment.faculty_id)
    .where(FacultyAssignment.offering_id == CourseOffering.offering_id)
    .correlate(CourseOffering)
    .scalar_subquery()
)


def student_rows() -> Select:
    return (
        select(
            Student.student_id,
            Student.enrollment_number,
            Student.first_name,
            Student.last_name,
            (Student.first_name + literal(" ") + Student.last_name).label("full_name"),
            Student.email,
            Student.phone,
            Student.date_of_birth,
            Student.gender,
            Student.admission_year,
            Student.department_id,
            Department.department_name,
            Student.status,
            Student.created_at,
            student_enrollment_count.label("enrollment_count"),
        )
        .select_from(Student)
        .outerjoin(Department, Department.department_id == Student.department_id)
    )


def faculty_rows() -> Select:
    return (
        select(
            Faculty.faculty_id,
            Faculty.employee_code,
            Faculty.first_name,
            Faculty.last_name,
            (Faculty.first_name + literal(" ") + Faculty.last_name).label("full_name"),
            Faculty.email,
            Faculty.phone,
            Faculty.designation,
            Faculty.joining_date,
            Faculty.department_id,
            Department.department_name,
            Faculty.created_at,
            faculty_assignment_count.label("assignment_count"),
        )
        .select_from(Faculty)
        .join(Department, Department.department_id == Faculty.department_id)
    )


def department_rows() -> Select:
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
    return select(
        Department.department_id,
        Department.department_code,
        Department.department_name,
        Department.office_location,
        Department.created_at,
        student_count.label("student_count"),
        faculty_count.label("faculty_count"),
        course_count.label("course_count"),
    )


def course_rows() -> Select:
    return (
        select(
            Course.course_id,
            Course.course_code,
            Course.course_name,
            Course.credits,
            Course.department_id,
            Department.department_name,
            Course.description,
            course_offering_count.label("offering_count"),
        )
        .select_from(Course)
        .join(Department, Department.department_id == Course.department_id)
    )


def semester_rows() -> Select:
    return select(
        Semester.semester_id,
        Semester.semester_name,
        Semester.academic_year,
        Semester.start_date,
        Semester.end_date,
        Semester.status,
        semester_offering_count.label("offering_count"),
    )


def offering_rows() -> Select:
    return (
        select(
            CourseOffering.offering_id,
            CourseOffering.course_id,
            Course.course_code,
            Course.course_name,
            Course.credits,
            CourseOffering.semester_id,
            Semester.semester_name,
            Semester.academic_year,
            Semester.status.label("semester_status"),
            CourseOffering.section,
            CourseOffering.capacity,
            offering_enrolled_count.label("enrolled"),
            (CourseOffering.capacity - offering_enrolled_count).label("seats_available"),
            offering_faculty_names.label("faculty_names"),
            CourseOffering.created_at,
        )
        .select_from(CourseOffering)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
    )


def assignment_rows() -> Select:
    return (
        select(
            FacultyAssignment.assignment_id,
            FacultyAssignment.faculty_id,
            (Faculty.first_name + literal(" ") + Faculty.last_name).label("faculty_name"),
            Faculty.employee_code,
            Department.department_name,
            FacultyAssignment.offering_id,
            Course.course_code,
            Course.course_name,
            Semester.semester_name,
            Semester.academic_year,
            CourseOffering.section,
            FacultyAssignment.assigned_at,
        )
        .select_from(FacultyAssignment)
        .join(Faculty, Faculty.faculty_id == FacultyAssignment.faculty_id)
        .join(Department, Department.department_id == Faculty.department_id)
        .join(CourseOffering, CourseOffering.offering_id == FacultyAssignment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
    )


def enrollment_rows() -> Select:
    return (
        select(
            Enrollment.enrollment_id,
            Enrollment.student_id,
            Student.enrollment_number,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Department.department_name,
            Enrollment.offering_id,
            Course.course_id,
            Course.course_code,
            Course.course_name,
            Semester.semester_id,
            Semester.semester_name,
            Semester.academic_year,
            CourseOffering.section,
            Enrollment.enrollment_date,
            Enrollment.enrollment_status,
            Grade.grade_letter,
        )
        .select_from(Enrollment)
        .join(Student, Student.student_id == Enrollment.student_id)
        .outerjoin(Department, Department.department_id == Student.department_id)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
        .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
    )


def grade_rows() -> Select:
    return (
        select(
            Grade.grade_id,
            Grade.enrollment_id,
            Enrollment.student_id,
            Student.enrollment_number,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Course.course_code,
            Course.course_name,
            Semester.semester_name,
            Semester.academic_year,
            Course.credits,
            Grade.marks_obtained,
            Grade.max_marks,
            Grade.grade_letter,
            func.round(Grade.marks_obtained / func.nullif(Grade.max_marks, 0) * 100, 2).label(
                "percentage"
            ),
            Grade.updated_at,
        )
        .select_from(Grade)
        .join(Enrollment, Enrollment.enrollment_id == Grade.enrollment_id)
        .join(Student, Student.student_id == Enrollment.student_id)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
    )


def student_enrollment_history(student_id: int) -> Select:
    return (
        select(
            Enrollment.enrollment_id,
            Course.course_code,
            Course.course_name,
            Course.credits,
            Semester.semester_name,
            Semester.academic_year,
            CourseOffering.section,
            Enrollment.enrollment_date,
            Enrollment.enrollment_status,
            Grade.marks_obtained,
            Grade.max_marks,
            Grade.grade_letter,
        )
        .select_from(Enrollment)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
        .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .where(Enrollment.student_id == student_id)
        .order_by(Semester.start_date.desc(), Course.course_code)
    )


def faculty_assignment_history(faculty_id: int) -> Select:
    return (
        assignment_rows()
        .where(Faculty.faculty_id == faculty_id)
        .order_by(Semester.academic_year.desc(), Course.course_code)
    )


def offering_students(offering_id: int) -> Select:
    return (
        select(
            Enrollment.enrollment_id,
            Enrollment.student_id,
            Student.enrollment_number,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Enrollment.enrollment_status,
            Grade.grade_letter,
        )
        .select_from(Enrollment)
        .join(Student, Student.student_id == Enrollment.student_id)
        .outerjoin(Grade, Grade.enrollment_id == Enrollment.enrollment_id)
        .where(Enrollment.offering_id == offering_id)
        .order_by(Student.first_name, Student.last_name)
    )


def offering_faculty(offering_id: int) -> Select:
    return (
        select(
            FacultyAssignment.assignment_id,
            Faculty.faculty_id,
            (Faculty.first_name + literal(" ") + Faculty.last_name).label("faculty_name"),
            Faculty.employee_code,
            Faculty.designation,
            Department.department_name,
            FacultyAssignment.assigned_at,
        )
        .select_from(FacultyAssignment)
        .join(Faculty, Faculty.faculty_id == FacultyAssignment.faculty_id)
        .join(Department, Department.department_id == Faculty.department_id)
        .where(FacultyAssignment.offering_id == offering_id)
    )
