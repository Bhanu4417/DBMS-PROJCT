"""Report endpoints plus CSV export."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import reports as service
from app.utils.pagination import csv_response

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
def report_catalog():
    return [
        {"key": key, "title": meta["title"], "columns": meta["columns"]}
        for key, meta in service.REPORTS.items()
    ]


@router.get("/students")
def students_report(db: Session = Depends(get_db)):
    return service.students_report(db)


@router.get("/faculty")
def faculty_report(db: Session = Depends(get_db)):
    return service.faculty_report(db)


@router.get("/academic")
def academic_report(db: Session = Depends(get_db)):
    return service.academic_report(db)


@router.get("/enrollments")
def enrollments_report(db: Session = Depends(get_db)):
    """Spec-aligned alias: enrollment counts and capacity utilisation."""
    return {
        "course_enrollment": service.report_rows(db, "course-enrollment"),
        "capacity_utilization": service.report_rows(db, "capacity-utilization"),
        "semester_summary": service.report_rows(db, "semester-summary"),
    }


@router.get("/grades")
def grades_report(db: Session = Depends(get_db)):
    """Spec-aligned alias: grade distribution plus the full grade report."""
    return {
        "grade_distribution": service.grade_distribution(db),
        "student_grades": service.report_rows(db, "grade-report"),
    }


@router.get("/export")
def export_report(report: str, db: Session = Depends(get_db)) -> Response:
    meta = service.REPORTS.get(report)
    if meta is None:
        raise HTTPException(404, "Unknown report")
    rows = service.report_rows(db, report)
    return csv_response(f"{report}.csv", meta["columns"], rows)
