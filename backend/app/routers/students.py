"""Student endpoints: list, detail with academic history, CRUD and select options."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import literal, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Department, Enrollment, Student
from app.schemas.common import Message, Option, Page
from app.schemas.entities import (
    StudentCreate,
    StudentDetail,
    StudentListItem,
    StudentRead,
    StudentUpdate,
)
from app.services.queries import student_enrollment_history, student_rows
from app.utils.db_ops import commit, delete_with_history_guard, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/students", tags=["students"])


@router.get("/options", response_model=list[Option])
def student_options(search: str | None = None, db: Session = Depends(get_db)):
    stmt = (
        select(
            Student.student_id,
            (Student.first_name + literal(" ") + Student.last_name),
            Student.enrollment_number,
        )
        .order_by(Student.first_name)
        .limit(500)
    )
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(Student.first_name.ilike(pattern), Student.last_name.ilike(pattern),
                Student.enrollment_number.ilike(pattern))
        )
    return [
        Option(value=row[0], label=f"{row[1]} ({row[2]})")
        for row in db.execute(stmt).all()
    ]


@router.get("", response_model=Page[StudentListItem])
def list_students(
    search: str | None = None,
    department_id: int | None = None,
    status: str | None = Query(default=None, pattern="^(Active|Graduated|Inactive)$"),
    admission_year: int | None = None,
    sort_by: str = Query(default="name"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = student_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Student.first_name.ilike(pattern),
                Student.last_name.ilike(pattern),
                Student.enrollment_number.ilike(pattern),
                Student.email.ilike(pattern),
            )
        )
    if department_id:
        stmt = stmt.where(Student.department_id == department_id)
    if status:
        stmt = stmt.where(Student.status == status)
    if admission_year:
        stmt = stmt.where(Student.admission_year == admission_year)

    column = sort_column(
        {
            "name": Student.first_name,
            "last_name": Student.last_name,
            "admission_year": Student.admission_year,
            "enrollment_number": Student.enrollment_number,
            "status": Student.status,
        },
        sort_by,
        Student.first_name,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{student_id}", response_model=StudentDetail)
def get_student(student_id: int, db: Session = Depends(get_db)):
    row = db.execute(student_rows().where(Student.student_id == student_id)).mappings().first()
    if row is None:
        get_or_404(db, Student, student_id, "Student")
    history = db.execute(student_enrollment_history(student_id)).mappings().all()
    return {**dict(row), "enrollments": [dict(item) for item in history]}


@router.post("", response_model=StudentRead, status_code=201)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)):
    if payload.department_id is not None:
        get_or_404(db, Department, payload.department_id, "Department")
    student = Student(**payload.model_dump())
    db.add(student)
    commit(db)
    db.refresh(student)
    return student


@router.put("/{student_id}", response_model=StudentRead)
def update_student(student_id: int, payload: StudentUpdate, db: Session = Depends(get_db)):
    student = get_or_404(db, Student, student_id, "Student")
    data = payload.model_dump(exclude_unset=True)
    if data.get("department_id") is not None:
        get_or_404(db, Department, data["department_id"], "Department")
    for field, value in data.items():
        setattr(student, field, value)
    commit(db)
    db.refresh(student)
    return student


@router.delete("/{student_id}", response_model=Message)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = get_or_404(db, Student, student_id, "Student")
    enrollments = db.query(Enrollment).filter(Enrollment.student_id == student_id).count()
    delete_with_history_guard(
        db,
        student,
        "student",
        f"{enrollments} enrollment record(s) are linked. Set the student to Inactive "
        "or remove the enrollments first." if enrollments else "",
    )
    return Message(detail="Student deleted")
