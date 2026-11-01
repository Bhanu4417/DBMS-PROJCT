"""Faculty assignment endpoints (many-to-many between faculty and offerings)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.entities import Course, CourseOffering, Faculty, FacultyAssignment, Semester
from app.schemas.common import Message, Page
from app.schemas.entities import AssignmentCreate, AssignmentRead, AssignmentUpdate
from app.services.queries import assignment_rows
from app.utils.db_ops import commit, get_or_404
from app.utils.pagination import apply_sort, page_payload, paginate, sort_column

router = APIRouter(prefix="/api/assignments", tags=["faculty assignments"])


@router.get("", response_model=Page[AssignmentRead])
def list_assignments(
    search: str | None = None,
    faculty_id: int | None = None,
    offering_id: int | None = None,
    semester_id: int | None = None,
    department_id: int | None = None,
    sort_by: str = Query(default="faculty"),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = assignment_rows()
    if search:
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Faculty.first_name.ilike(pattern),
                Faculty.last_name.ilike(pattern),
                Faculty.employee_code.ilike(pattern),
                Course.course_code.ilike(pattern),
                Course.course_name.ilike(pattern),
            )
        )
    if faculty_id:
        stmt = stmt.where(FacultyAssignment.faculty_id == faculty_id)
    if offering_id:
        stmt = stmt.where(FacultyAssignment.offering_id == offering_id)
    if semester_id:
        stmt = stmt.where(CourseOffering.semester_id == semester_id)
    if department_id:
        stmt = stmt.where(Faculty.department_id == department_id)

    column = sort_column(
        {"faculty": Faculty.first_name, "course": Course.course_code, "date": FacultyAssignment.assigned_at},
        sort_by,
        Faculty.first_name,
    )
    rows, total = paginate(db, apply_sort(stmt, column, sort_dir), page, page_size)
    return page_payload([dict(row._mapping) for row in rows], total, page, page_size)


@router.get("/{assignment_id}", response_model=AssignmentRead)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        assignment_rows().where(FacultyAssignment.assignment_id == assignment_id)
    ).mappings().first()
    if row is None:
        get_or_404(db, FacultyAssignment, assignment_id, "Assignment")
    return dict(row)


@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(payload: AssignmentCreate, db: Session = Depends(get_db)):
    get_or_404(db, Faculty, payload.faculty_id, "Faculty member")
    get_or_404(db, CourseOffering, payload.offering_id, "Course offering")
    assignment = FacultyAssignment(**payload.model_dump())
    db.add(assignment)
    commit(db)
    db.refresh(assignment)
    return get_assignment(assignment.assignment_id, db)


@router.put("/{assignment_id}", response_model=AssignmentRead)
def update_assignment(assignment_id: int, payload: AssignmentUpdate, db: Session = Depends(get_db)):
    assignment = get_or_404(db, FacultyAssignment, assignment_id, "Assignment")
    data = payload.model_dump(exclude_unset=True)
    if data.get("faculty_id") is not None:
        get_or_404(db, Faculty, data["faculty_id"], "Faculty member")
    if data.get("offering_id") is not None:
        get_or_404(db, CourseOffering, data["offering_id"], "Course offering")
    for field, value in data.items():
        setattr(assignment, field, value)
    commit(db)
    return get_assignment(assignment_id, db)


@router.delete("/{assignment_id}", response_model=Message)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = get_or_404(db, FacultyAssignment, assignment_id, "Assignment")
    db.delete(assignment)
    commit(db)
    return Message(detail="Assignment removed")
