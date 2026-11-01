"""Course endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Course, CourseOffering, Department, Enrollment, Semester
from app.schemas.common import Message, Option, Page
from app.schemas.entities import CourseCreate, CourseDetail, CourseListItem, CourseRead, CourseUpdate
from app.services.queries import course_rows
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.get("/options", response_model=list[Option])
def course_options(search: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Course.course_id, Course.course_code, Course.course_name).order_by(Course.course_code)
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Course.course_code.ilike(pattern), Course.course_name.ilike(pattern)))
    return [
        Option(value=row[0], label=f"{row[1]} — {row[2]}")
        for row in db.execute(stmt.limit(500)).all()
    ]


@router.get("", response_model=Page[CourseListItem])
def list_courses(
    search: str | None = None,
    department_id: int | None = None,
    min_credits: int | None = Query(default=None, ge=1, le=6),
    sort_by: str = Query(default="code"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = course_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Course.course_code.ilike(pattern), Course.course_name.ilike(pattern)))
    if department_id:
        stmt = stmt.where(Course.department_id == department_id)
    if min_credits:
        stmt = stmt.where(Course.credits >= min_credits)

    column = sort_column(
        {"code": Course.course_code, "name": Course.course_name, "credits": Course.credits},
        sort_by,
        Course.course_code,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{course_id}", response_model=CourseDetail)
def get_course(course_id: int, db: Session = Depends(get_db)):
    row = db.execute(course_rows().where(Course.course_id == course_id)).mappings().first()
    if row is None:
        get_or_404(db, Course, course_id, "Course")
    enrolled = (
        select(func.count(Enrollment.enrollment_id))
        .where(
            Enrollment.offering_id == CourseOffering.offering_id,
            Enrollment.enrollment_status != "Dropped",
        )
        .correlate(CourseOffering)
        .scalar_subquery()
    )
    offerings = db.execute(
        select(
            CourseOffering.offering_id,
            Course.course_code,
            Course.course_name,
            Semester.semester_name,
            Semester.academic_year,
            CourseOffering.section,
            CourseOffering.capacity,
            enrolled.label("enrolled"),
            Semester.status.label("semester_status"),
        )
        .select_from(CourseOffering)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
        .where(CourseOffering.course_id == course_id)
        .order_by(Semester.start_date.desc(), CourseOffering.section)
    ).mappings().all()
    return {**dict(row), "offerings": [dict(item) for item in offerings]}


@router.post("", response_model=CourseRead, status_code=201)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    get_or_404(db, Department, payload.department_id, "Department")
    course = Course(**payload.model_dump())
    db.add(course)
    commit(db)
    db.refresh(course)
    return course


@router.put("/{course_id}", response_model=CourseRead)
def update_course(course_id: int, payload: CourseUpdate, db: Session = Depends(get_db)):
    course = get_or_404(db, Course, course_id, "Course")
    data = payload.model_dump(exclude_unset=True)
    if data.get("department_id") is not None:
        get_or_404(db, Department, data["department_id"], "Department")
    for field, value in data.items():
        setattr(course, field, value)
    commit(db)
    db.refresh(course)
    return course


@router.delete("/{course_id}", response_model=Message)
def delete_course(course_id: int, db: Session = Depends(get_db)):
    course = get_or_404(db, Course, course_id, "Course")
    offerings = db.query(CourseOffering).filter(CourseOffering.course_id == course_id).count()
    delete_with_history_guard(
        db,
        course,
        "course",
        f"{offerings} course offering(s) are linked. Delete the offerings first."
        if offerings else "",
    )
    return Message(detail="Course deleted")
