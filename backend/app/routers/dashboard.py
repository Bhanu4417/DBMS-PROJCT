"""Dashboard endpoints: live counts, charts and recent activity."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import dashboard as service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    return service.stats(db)


@router.get("/charts")
def dashboard_charts(db: Session = Depends(get_db)):
    return service.charts(db)


@router.get("/activity")
def dashboard_activity(limit: int = 5, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 20))
    return {
        "recent_students": service.recent_students(db, limit),
        "recent_enrollments": service.recent_enrollments(db, limit),
        "popular_courses": service.popular_courses(db, limit),
        "department_overview": service.department_overview(db),
    }
