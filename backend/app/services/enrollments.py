"""Enrollment service — capacity, duplicates and transactions live here.

The API does not trust the browser: it locks the offering row, recounts inside the
transaction and only then inserts. A PostgreSQL trigger repeats the check so the
rule also holds for direct SQL clients.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.entities import CourseOffering, Enrollment, Student
from app.utils.errors import integrity_error

def count_active_enrollments(db: Session, offering_id: int) -> int:
    return db.scalar(
        select(func.count(Enrollment.enrollment_id)).where(
            Enrollment.offering_id == offering_id,
            Enrollment.enrollment_status != "Dropped",
        )
    ) or 0


def enroll_student(db: Session, student_id: int, offering_id: int, enrollment_date=None,
                   enrollment_status: str = "Enrolled") -> Enrollment:
    try:
        if db.get(Student, student_id) is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

        # Serialise concurrent enrollments for this offering.
        offering = db.execute(
            select(CourseOffering).where(CourseOffering.offering_id == offering_id).with_for_update()
        ).scalar_one_or_none()
        if offering is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Course offering not found")

        duplicate = db.scalar(
            select(Enrollment.enrollment_id).where(
                Enrollment.student_id == student_id,
                Enrollment.offering_id == offering_id,
            )
        )
        if duplicate:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "This student is already enrolled in this course offering.",
            )

        if enrollment_status != "Dropped":
            taken = count_active_enrollments(db, offering_id)
            if taken >= offering.capacity:
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"This offering is full: {taken} of {offering.capacity} seats are taken.",
                )

        enrollment = Enrollment(
            student_id=student_id,
            offering_id=offering_id,
            enrollment_status=enrollment_status,
            **({"enrollment_date": enrollment_date} if enrollment_date else {}),
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        return enrollment
    except IntegrityError as exc:
        db.rollback()
        raise integrity_error(exc) from exc
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
