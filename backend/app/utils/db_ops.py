"""Small database helpers shared by the routers."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.exc import DBAPIError, IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.utils.errors import db_unavailable, integrity_error


def commit(db: Session) -> None:
    """Commit and translate constraint errors into readable HTTP errors."""
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise integrity_error(exc) from exc
    except OperationalError as exc:
        db.rollback()
        raise db_unavailable(exc) from exc
    except DBAPIError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc.orig).splitlines()[0]) from exc


def refresh(db: Session, instance):
    db.refresh(instance)
    return instance


def get_or_404(db: Session, model, identifier: int, label: str):
    instance = db.get(model, identifier)
    if instance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return instance


def delete_with_history_guard(db: Session, instance, label: str, dependents: str) -> None:
    """Delete a row, refusing when it owns dependent records."""
    if dependents:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot delete this {label}: {dependents}")
    db.delete(instance)
    commit(db)
