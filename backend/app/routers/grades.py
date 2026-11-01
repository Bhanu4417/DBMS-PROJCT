"""Grade endpoints — one grade per enrollment, marks validated in schema and database."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Course, Enrollment, Grade, Semester, Student
from app.schemas.common import Message, Page
from app.schemas.entities import GradeCreate, GradeRead, GradeSimple, GradeUpdate
from app.services.queries import grade_rows
from app.utils.db_ops import commit, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/grades", tags=["grades"])


@router.get("", response_model=Page[GradeRead])
def list_grades(
    search: str | None = None,
    course_id: int | None = None,
    semester_id: int | None = None,
    grade_letter: str | None = None,
    sort_by: str = Query(default="student"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = grade_rows()
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
    if course_id:
        stmt = stmt.where(Course.course_id == course_id)
    if semester_id:
        stmt = stmt.where(Semester.semester_id == semester_id)
    if grade_letter:
        stmt = stmt.where(Grade.grade_letter == grade_letter)

    column = sort_column(
        {"student": Student.first_name, "course": Course.course_code, "marks": Grade.marks_obtained},
        sort_by,
        Student.first_name,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{grade_id}", response_model=GradeRead)
def get_grade(grade_id: int, db: Session = Depends(get_db)):
    row = db.execute(grade_rows().where(Grade.grade_id == grade_id)).mappings().first()
    if row is None:
        get_or_404(db, Grade, grade_id, "Grade")
    return dict(row)


@router.post("", response_model=GradeSimple, status_code=201)
def create_grade(payload: GradeCreate, db: Session = Depends(get_db)):
    get_or_404(db, Enrollment, payload.enrollment_id, "Enrollment")
    existing = db.query(Grade).filter(Grade.enrollment_id == payload.enrollment_id).first()
    if existing:
        from fastapi import HTTPException

        raise HTTPException(409, "This enrollment already has a grade. Edit the existing record.")
    grade = Grade(**payload.model_dump())
    db.add(grade)
    commit(db)
    db.refresh(grade)
    return grade


@router.put("/{grade_id}", response_model=GradeSimple)
def update_grade(grade_id: int, payload: GradeUpdate, db: Session = Depends(get_db)):
    grade = get_or_404(db, Grade, grade_id, "Grade")
    data = payload.model_dump(exclude_unset=True)
    marks = data.get("marks_obtained", grade.marks_obtained)
    maximum = data.get("max_marks", grade.max_marks)
    if marks is not None and maximum is not None and marks > maximum:
        from fastapi import HTTPException

        raise HTTPException(400, "Marks obtained cannot exceed the maximum marks.")
    for field, value in data.items():
        setattr(grade, field, value)
    commit(db)
    db.refresh(grade)
    return grade


@router.delete("/{grade_id}", response_model=Message)
def delete_grade(grade_id: int, db: Session = Depends(get_db)):
    grade = get_or_404(db, Grade, grade_id, "Grade")
    db.delete(grade)
    commit(db)
    return Message(detail="Grade deleted")
