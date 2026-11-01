"""Course offering endpoints, including enrolled students and assigned faculty."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Course, CourseOffering, Enrollment, FacultyAssignment, Semester
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    OfferingCreate,
    OfferingDetail,
    OfferingListItem,
    OfferingRead,
    OfferingUpdate,
)
from app.services.queries import offering_faculty, offering_rows, offering_students
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/offerings", tags=["offerings"])


@router.get("/options", response_model=list[Option])
def offering_options(
    semester_id: int | None = None,
    only_available: bool = False,
    db: Session = Depends(get_db),
):
    stmt = offering_rows().order_by(Course.course_code, Semester.start_date)
    if semester_id:
        stmt = stmt.where(CourseOffering.semester_id == semester_id)
    if only_available:
        stmt = stmt.where(CourseOffering.capacity > 0)
    rows = db.execute(stmt.limit(500)).mappings().all()
    return [
        Option(
            value=row["offering_id"],
            label=(
                f"{row['course_code']} — {row['course_name']} · {row['semester_name']} "
                f"{row['academic_year']} · Sec {row['section']} "
                f"({row['seats_available']}/{row['capacity']} seats free)"
            ),
            meta=str(row["seats_available"]),
        )
        for row in rows
    ]


@router.get("", response_model=Page[OfferingListItem])
def list_offerings(
    search: str | None = None,
    course_id: int | None = None,
    semester_id: int | None = None,
    section: str | None = None,
    sort_by: str = Query(default="course"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = offering_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(or_(Course.course_code.ilike(pattern), Course.course_name.ilike(pattern)))
    if course_id:
        stmt = stmt.where(CourseOffering.course_id == course_id)
    if semester_id:
        stmt = stmt.where(CourseOffering.semester_id == semester_id)
    if section:
        stmt = stmt.where(CourseOffering.section == section)

    column = sort_column(
        {"course": Course.course_code, "capacity": CourseOffering.capacity,
         "semester": Semester.start_date},
        sort_by,
        Course.course_code,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{offering_id}", response_model=OfferingDetail)
def get_offering(offering_id: int, db: Session = Depends(get_db)):
    row = db.execute(offering_rows().where(CourseOffering.offering_id == offering_id)).mappings().first()
    if row is None:
        get_or_404(db, CourseOffering, offering_id, "Course offering")
    students = db.execute(offering_students(offering_id)).mappings().all()
    faculty = db.execute(offering_faculty(offering_id)).mappings().all()
    return {
        **dict(row),
        "students": [dict(item) for item in students],
        "faculty": [dict(item) for item in faculty],
    }


@router.post("", response_model=OfferingRead, status_code=201)
def create_offering(payload: OfferingCreate, db: Session = Depends(get_db)):
    get_or_404(db, Course, payload.course_id, "Course")
    get_or_404(db, Semester, payload.semester_id, "Semester")
    offering = CourseOffering(**payload.model_dump())
    db.add(offering)
    commit(db)
    db.refresh(offering)
    return offering


@router.put("/{offering_id}", response_model=OfferingRead)
def update_offering(offering_id: int, payload: OfferingUpdate, db: Session = Depends(get_db)):
    offering = get_or_404(db, CourseOffering, offering_id, "Course offering")
    data = payload.model_dump(exclude_unset=True)
    if data.get("course_id") is not None:
        get_or_404(db, Course, data["course_id"], "Course")
    if data.get("semester_id") is not None:
        get_or_404(db, Semester, data["semester_id"], "Semester")
    for field, value in data.items():
        setattr(offering, field, value)
    commit(db)
    db.refresh(offering)
    return offering


@router.delete("/{offering_id}", response_model=Message)
def delete_offering(offering_id: int, db: Session = Depends(get_db)):
    offering = get_or_404(db, CourseOffering, offering_id, "Course offering")
    enrollments = db.query(Enrollment).filter(Enrollment.offering_id == offering_id).count()
    assignments = db.query(FacultyAssignment).filter(
        FacultyAssignment.offering_id == offering_id
    ).count()
    parts = []
    if enrollments:
        parts.append(f"{enrollments} enrollment(s)")
    if assignments:
        parts.append(f"{assignments} faculty assignment(s)")
    delete_with_history_guard(
        db,
        offering,
        "course offering",
        ", ".join(parts) + " depend on it. Remove them first." if parts else "",
    )
    return Message(detail="Course offering deleted")
