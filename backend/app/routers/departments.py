"""Department endpoints with live student / faculty / course counts."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Course, Department, Faculty, Student
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    DepartmentCreate,
    DepartmentListItem,
    DepartmentRead,
    DepartmentUpdate,
)
from app.services.queries import department_rows
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("/options", response_model=list[Option])
def department_options(db: Session = Depends(get_db)):
    rows = db.execute(select(Department.department_id, Department.department_name)
                      .order_by(Department.department_code)).all()
    return [Option(value=row[0], label=row[1]) for row in rows]


@router.get("", response_model=Page[DepartmentListItem])
def list_departments(
    search: str | None = None,
    sort_by: str | None = Query(default="code"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = department_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Department.department_name.ilike(pattern), Department.department_code.ilike(pattern))
        )
    column = sort_column(
        {"code": Department.department_code, "name": Department.department_name},
        sort_by,
        Department.department_code,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{department_id}", response_model=DepartmentRead)
def get_department(department_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Department, department_id, "Department")


@router.post("", response_model=DepartmentRead, status_code=201)
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    department = Department(**payload.model_dump())
    db.add(department)
    commit(db)
    db.refresh(department)
    return department


@router.put("/{department_id}", response_model=DepartmentRead)
def update_department(department_id: int, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    department = get_or_404(db, Department, department_id, "Department")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, field, value)
    commit(db)
    db.refresh(department)
    return department


@router.delete("/{department_id}", response_model=Message)
def delete_department(department_id: int, db: Session = Depends(get_db)):
    department = get_or_404(db, Department, department_id, "Department")
    students = db.scalar(select(func.count()).select_from(Student)
                         .where(Student.department_id == department_id)) or 0
    faculty = db.scalar(select(func.count()).select_from(Faculty)
                        .where(Faculty.department_id == department_id)) or 0
    courses = db.scalar(select(func.count()).select_from(Course)
                        .where(Course.department_id == department_id)) or 0
    parts = []
    if students:
        parts.append(f"{students} student(s)")
    if faculty:
        parts.append(f"{faculty} faculty member(s)")
    if courses:
        parts.append(f"{courses} course(s)")
    delete_with_history_guard(db, department, "department", ", ".join(parts) + " still depend on it"
                              if parts else "")
    return Message(detail="Department deleted")
