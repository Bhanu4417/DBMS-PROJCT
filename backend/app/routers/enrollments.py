"""Enrollment endpoints with capacity-safe transactional inserts."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import literal, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import (
    Course,
    CourseOffering,
    Enrollment,
    Grade,
    Semester,
    Student,
)
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    EnrollmentCreate,
    EnrollmentRead,
    EnrollmentSimple,
    EnrollmentUpdate,
)
from app.services.enrollments import count_active_enrollments, enroll_student
from app.services.queries import enrollment_rows
from app.utils.db_ops import commit, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/enrollments", tags=["enrollments"])


@router.get("/options", response_model=list[Option])
def enrollment_options(
    ungraded: bool = False,
    student_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = (
        select(
            Enrollment.enrollment_id,
            Student.enrollment_number,
            (Student.first_name + literal(" ") + Student.last_name).label("student_name"),
            Course.course_code,
            Course.course_name,
            Semester.semester_name,
            Semester.academic_year,
        )
        .select_from(Enrollment)
        .join(Student, Student.student_id == Enrollment.student_id)
        .join(CourseOffering, CourseOffering.offering_id == Enrollment.offering_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
        .order_by(Student.enrollment_number, Course.course_code)
        .limit(500)
    )
    if ungraded:
        graded = select(Grade.enrollment_id).scalar_subquery()
        stmt = stmt.where(Enrollment.enrollment_id.not_in(graded))
    if student_id:
        stmt = stmt.where(Enrollment.student_id == student_id)
    return [
        Option(
            value=row.enrollment_id,
            label=(
                f"{row.student_name} ({row.enrollment_number}) — {row.course_code} "
                f"{row.course_name} · {row.semester_name} {row.academic_year}"
            ),
        )
        for row in db.execute(stmt).all()
    ]


@router.get("", response_model=Page[EnrollmentRead])
def list_enrollments(
    search: str | None = None,
    student_id: int | None = None,
    offering_id: int | None = None,
    course_id: int | None = None,
    semester_id: int | None = None,
    enrollment_status: str | None = Query(
        default=None, pattern="^(Enrolled|Completed|Dropped)$"
    ),
    has_grade: bool | None = None,
    sort_by: str = Query(default="date"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = enrollment_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Student.first_name.ilike(pattern),
                Student.last_name.ilike(pattern),
                Student.enrollment_number.ilike(pattern),
                Course.course_code.ilike(pattern),
                Course.course_name.ilike(pattern),
            )
        )
    if student_id:
        stmt = stmt.where(Enrollment.student_id == student_id)
    if offering_id:
        stmt = stmt.where(Enrollment.offering_id == offering_id)
    if course_id:
        stmt = stmt.where(Course.course_id == course_id)
    if semester_id:
        stmt = stmt.where(Semester.semester_id == semester_id)
    if enrollment_status:
        stmt = stmt.where(Enrollment.enrollment_status == enrollment_status)
    if has_grade is not None:
        stmt = stmt.where(Grade.grade_id.is_not(None) if has_grade else Grade.grade_id.is_(None))

    column = sort_column(
        {
            "date": Enrollment.enrollment_date,
            "student": Student.first_name,
            "course": Course.course_code,
            "status": Enrollment.enrollment_status,
        },
        sort_by,
        Enrollment.enrollment_date,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{enrollment_id}", response_model=EnrollmentRead)
def get_enrollment(enrollment_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        enrollment_rows().where(Enrollment.enrollment_id == enrollment_id)
    ).mappings().first()
    if row is None:
        get_or_404(db, Enrollment, enrollment_id, "Enrollment")
    return dict(row)


@router.post("", response_model=EnrollmentSimple, status_code=201)
def create_enrollment(payload: EnrollmentCreate, db: Session = Depends(get_db)):
    enrollment = enroll_student(
        db,
        student_id=payload.student_id,
        offering_id=payload.offering_id,
        enrollment_date=payload.enrollment_date,
        enrollment_status=payload.enrollment_status,
    )
    return enrollment


@router.put("/{enrollment_id}", response_model=EnrollmentSimple)
def update_enrollment(
    enrollment_id: int, payload: EnrollmentUpdate, db: Session = Depends(get_db)
):
    enrollment = get_or_404(db, Enrollment, enrollment_id, "Enrollment")
    data = payload.model_dump(exclude_unset=True)
    new_status = data.get("enrollment_status")

    # Re-activating a dropped enrollment must respect capacity again.
    if new_status in ("Enrolled", "Completed") and enrollment.enrollment_status == "Dropped":
        offering = db.execute(
            select(CourseOffering)
            .where(CourseOffering.offering_id == enrollment.offering_id)
            .with_for_update()
        ).scalar_one()
        taken = count_active_enrollments(db, enrollment.offering_id)
        if taken >= offering.capacity:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"This offering is full: {taken} of {offering.capacity} seats are taken.",
            )

    for field, value in data.items():
        setattr(enrollment, field, value)
    commit(db)
    db.refresh(enrollment)
    return enrollment


@router.delete("/{enrollment_id}", response_model=Message)
def delete_enrollment(enrollment_id: int, db: Session = Depends(get_db)):
    enrollment = get_or_404(db, Enrollment, enrollment_id, "Enrollment")
    grade = db.query(Grade).filter(Grade.enrollment_id == enrollment_id).first()
    if grade:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "This enrollment has a grade. Delete the grade first, or mark the enrollment "
            "as Dropped instead of deleting academic history.",
        )
    db.delete(enrollment)
    commit(db)
    return Message(detail="Enrollment removed")
