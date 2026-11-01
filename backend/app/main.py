"""CampusOS FastAPI application entry point.

Run with:  uvicorn app.main:app --reload   (from the backend/ directory)
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.database import engine
from app.routers import (
    assignments,
    courses,
    dashboard,
    departments,
    enrollments,
    faculty,
    grades,
    offerings,
    reports,
    semesters,
    students,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("campusos")

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "REST API for the CampusOS college management system. Every number, chart and "
        "report is produced by a live PostgreSQL query."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    students.router,
    faculty.router,
    departments.router,
    courses.router,
    semesters.router,
    offerings.router,
    assignments.router,
    enrollments.router,
    grades.router,
    dashboard.router,
    reports.router,
):
    app.include_router(router)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    """Return structured, human-readable validation errors."""
    errors = []
    for error in exc.errors():
        field = ".".join(str(part) for part in error["loc"] if part not in ("body", "query"))
        errors.append({"field": field, "message": error["msg"]})
    return JSONResponse(
        status_code=422,
        content={"detail": "Please correct the highlighted fields.", "errors": errors},
    )


@app.exception_handler(OperationalError)
async def database_down_handler(request: Request, exc: OperationalError):
    logger.error("Database error: %s", exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": "The database is unavailable. Check DATABASE_URL and that PostgreSQL is running."
        },
    )


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    """Never expose stack traces to the browser."""
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An unexpected server error occurred."})


@app.get("/api/health", tags=["system"])
def health():
    try:
        with engine.connect() as connection:
            version = connection.execute(text("SHOW server_version")).scalar()
        return {"status": "ok", "database": "connected", "postgres_version": version}
    except Exception:  # pragma: no cover - depends on environment
        logger.exception("Health check failed")
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "database": "unavailable",
                "detail": "PostgreSQL is not reachable. Check DATABASE_URL in backend/.env.",
            },
        )


@app.get("/", tags=["system"])
def root():
    return {
        "application": settings.app_name,
        "version": settings.app_version,
        "docs": "/docs",
        "health": "/api/health",
    }
