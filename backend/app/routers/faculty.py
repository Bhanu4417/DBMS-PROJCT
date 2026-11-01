"""Faculty endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import literal, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Department, Faculty, FacultyAssignment
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    FacultyCreate,
    FacultyDetail,
    FacultyListItem,
    FacultyRead,
    FacultyUpdate,
)
from app.services.queries import faculty_assignment_history, faculty_rows
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/faculty", tags=["faculty"])


@router.get("/options", response_model=list[Option])
def faculty_options(search: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(
            Faculty.faculty_id,
            (Faculty.first_name + literal(" ") + Faculty.last_name),
            Faculty.employee_code,
        )
        .order_by(Faculty.first_name)
        .limit(500)
    )
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Faculty.first_name.ilike(pattern), Faculty.last_name.ilike(pattern),
                Faculty.employee_code.ilike(pattern))
        )
    return [Option(value=row[0], label=f"{row[1]} ({row[2]})") for row in db.execute(stmt).all()]


@router.get("", response_model=Page[FacultyListItem])
def list_faculty(
    search: str | None = None,
    department_id: int | None = None,
    designation: str | None = None,
    sort_by: str = Query(default="name"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = faculty_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Faculty.first_name.ilike(pattern),
                Faculty.last_name.ilike(pattern),
                Faculty.employee_code.ilike(pattern),
                Faculty.email.ilike(pattern),
            )
        )
    if department_id:
        stmt = stmt.where(Faculty.department_id == department_id)
    if designation:
        stmt = stmt.where(Faculty.designation == designation)

    column = sort_column(
        {"name": Faculty.first_name, "designation": Faculty.designation,
         "employee_code": Faculty.employee_code},
        sort_by,
        Faculty.first_name,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{faculty_id}", response_model=FacultyDetail)
def get_faculty(faculty_id: int, db: Session = Depends(get_db)):
    row = db.execute(faculty_rows().where(Faculty.faculty_id == faculty_id)).mappings().first()
    if row is None:
        get_or_404(db, Faculty, faculty_id, "Faculty member")
    assignments = db.execute(faculty_assignment_history(faculty_id)).mappings().all()
    return {**dict(row), "assignments": [dict(item) for item in assignments]}


@router.post("", response_model=FacultyRead, status_code=201)
def create_faculty(payload: FacultyCreate, db: Session = Depends(get_db)):
    get_or_404(db, Department, payload.department_id, "Department")
    faculty = Faculty(**payload.model_dump())
    db.add(faculty)
    commit(db)
    db.refresh(faculty)
    return faculty


@router.put("/{faculty_id}", response_model=FacultyRead)
def update_faculty(faculty_id: int, payload: FacultyUpdate, db: Session = Depends(get_db)):
    faculty = get_or_404(db, Faculty, faculty_id, "Faculty member")
    data = payload.model_dump(exclude_unset=True)
    if data.get("department_id") is not None:
        get_or_404(db, Department, data["department_id"], "Department")
    for field, value in data.items():
        setattr(faculty, field, value)
    commit(db)
    db.refresh(faculty)
    return faculty


@router.delete("/{faculty_id}", response_model=Message)
def delete_faculty(faculty_id: int, db: Session = Depends(get_db)):
    faculty = get_or_404(db, Faculty, faculty_id, "Faculty member")
    assignments = db.query(FacultyAssignment).filter(
        FacultyAssignment.faculty_id == faculty_id
    ).count()
    delete_with_history_guard(
        db,
        faculty,
        "faculty member",
        f"{assignments} course assignment(s) are linked. Remove the assignments first."
        if assignments else "",
    )
    return Message(detail="Faculty member deleted")
