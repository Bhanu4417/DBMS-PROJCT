"""Semester endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import CourseOffering, Semester
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    OfferingSummary,
    SemesterCreate,
    SemesterListItem,
    SemesterRead,
    SemesterUpdate,
)
from app.services.queries import semester_rows
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/semesters", tags=["semesters"])


def _validate_dates(start, end) -> None:
    from fastapi import HTTPException

    if start and end and end <= start:
        raise HTTPException(400, "The semester end date must be later than the start date.")


@router.get("/options", response_model=list[Option])
def semester_options(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Semester.semester_id, Semester.semester_name, Semester.academic_year, Semester.status)
        .order_by(Semester.start_date.desc())
    ).all()
    return [Option(value=row[0], label=f"{row[1]} {row[2]} ({row[3]})", meta=row[3]) for row in rows]


@router.get("", response_model=Page[SemesterListItem])
def list_semesters(
    search: str | None = None,
    status: str | None = Query(default=None, pattern="^(Upcoming|Active|Completed)$"),
    academic_year: str | None = None,
    sort_by: str = Query(default="start"),
    sort_dir: str = Query(default="desc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = semester_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Semester.semester_name.ilike(pattern), Semester.academic_year.ilike(pattern))
        )
    if status:
        stmt = stmt.where(Semester.status == status)
    if academic_year:
        stmt = stmt.where(Semester.academic_year == academic_year)

    column = sort_column(
        {"start": Semester.start_date, "name": Semester.semester_name, "status": Semester.status},
        sort_by,
        Semester.start_date,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{semester_id}", response_model=SemesterRead)
def get_semester(semester_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Semester, semester_id, "Semester")


@router.get("/{semester_id}/offerings", response_model=list[OfferingSummary])
def semester_offerings(semester_id: int, db: Session = Depends(get_db)):
    from app.models.entities import Course, Enrollment
    from sqlalchemy import func

    get_or_404(db, Semester, semester_id, "Semester")
    enrolled = (
        select(func.count(Enrollment.enrollment_id))
        .where(
            Enrollment.offering_id == CourseOffering.offering_id,
            Enrollment.enrollment_status != "Dropped",
        )
        .correlate(CourseOffering)
        .scalar_subquery()
    )
    rows = db.execute(
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
        .join(Semester, Semester.semester_id == CourseOffering.semester_id)
        .join(Course, Course.course_id == CourseOffering.course_id)
        .where(CourseOffering.semester_id == semester_id)
        .order_by(Course.course_code, CourseOffering.section)
    ).mappings().all()
    return [dict(row) for row in rows]


@router.post("", response_model=SemesterRead, status_code=201)
def create_semester(payload: SemesterCreate, db: Session = Depends(get_db)):
    semester = Semester(**payload.model_dump())
    db.add(semester)
    commit(db)
    db.refresh(semester)
    return semester


@router.put("/{semester_id}", response_model=SemesterRead)
def update_semester(semester_id: int, payload: SemesterUpdate, db: Session = Depends(get_db)):
    semester = get_or_404(db, Semester, semester_id, "Semester")
    data = payload.model_dump(exclude_unset=True)
    start = data.get("start_date", semester.start_date)
    end = data.get("end_date", semester.end_date)
    _validate_dates(start, end)
    for field, value in data.items():
        setattr(semester, field, value)
    commit(db)
    db.refresh(semester)
    return semester


@router.delete("/{semester_id}", response_model=Message)
def delete_semester(semester_id: int, db: Session = Depends(get_db)):
    semester = get_or_404(db, Semester, semester_id, "Semester")
    offerings = db.query(CourseOffering).filter(CourseOffering.semester_id == semester_id).count()
    delete_with_history_guard(
        db,
        semester,
        "semester",
        f"{offerings} course offering(s) are linked. Delete the offerings first."
        if offerings else "",
    )
    return Message(detail="Semester deleted")
