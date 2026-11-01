#!/usr/bin/env python3
"""Verify the database: tables, keys, constraints, triggers, views and indexes.

Usage:
    python scripts/verify_database.py                 # uses DATABASE_URL / backend/.env
    DATABASE_URL=postgresql+psycopg://... python scripts/verify_database.py

Exits with status 1 when a required object is missing.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

try:
    from app.config import settings  # reads backend/.env
    DEFAULT_URL = settings.database_url
except Exception:  # pragma: no cover - standalone use
    DEFAULT_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/college"

DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_URL)

REQUIRED_TABLES = [
    "department", "student", "faculty", "course", "semester",
    "course_offering", "faculty_assignment", "enrollment", "grade",
]
REQUIRED_CONSTRAINTS = {
    "primary keys": [
        "department_pkey", "student_pkey", "faculty_pkey", "course_pkey", "semester_pkey",
        "course_offering_pkey", "faculty_assignment_pkey", "enrollment_pkey", "grade_pkey",
    ],
    "unique": [
        "uq_department_code", "uq_department_name", "uq_student_enrollment_number",
        "uq_student_email", "uq_faculty_employee_code", "uq_faculty_email", "uq_course_code",
        "uq_semester_term", "uq_offering_course_semester_section",
        "uq_assignment_faculty_offering", "uq_enrollment_student_offering", "uq_grade_enrollment",
    ],
    "foreign keys": [
        "fk_student_department", "fk_faculty_department", "fk_course_department",
        "fk_offering_course", "fk_offering_semester", "fk_assignment_faculty",
        "fk_assignment_offering", "fk_enrollment_student", "fk_enrollment_offering",
        "fk_grade_enrollment",
    ],
    "checks": [
        "ck_course_credits", "ck_offering_capacity", "ck_semester_dates", "ck_semester_status",
        "ck_student_status", "ck_student_gender", "ck_student_admission_year",
        "ck_enrollment_status", "ck_grade_marks_within_max", "ck_grade_marks_non_negative",
        "ck_grade_max_positive", "ck_grade_letter",
    ],
}
REQUIRED_TRIGGERS = ["trg_enrollment_capacity", "trg_offering_capacity_reduction", "trg_grade_touch"]
REQUIRED_VIEWS = [
    "v_enrollment_details", "v_offering_utilization", "v_student_academic_summary",
]
REQUIRED_INDEXES = [
    "idx_student_department", "idx_faculty_department", "idx_course_department",
    "idx_offering_semester", "idx_enrollment_offering", "idx_enrollment_student",
    "idx_assignment_offering",
]


def main() -> int:
    engine = create_engine(DATABASE_URL)
    problems: list[str] = []

    with engine.connect() as connection:
        print(f"Database: {DATABASE_URL.rsplit('@', 1)[-1]}\n")

        tables = set(connection.execute(text("""
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        """)).scalars())
        print("Tables")
        for table in REQUIRED_TABLES:
            if table not in tables:
                problems.append(f"missing table: {table}")
                print(f"  ✗ {table}")
                continue
            count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar()
            print(f"  ✓ {table:<22} {count:>6} rows")

        constraints = set(connection.execute(text(
            "SELECT conname FROM pg_constraint"
        )).scalars())
        print("\nConstraints")
        for category, names in REQUIRED_CONSTRAINTS.items():
            missing = [name for name in names if name not in constraints]
            status = "✓" if not missing else "✗"
            print(f"  {status} {category:<14} {len(names) - len(missing)}/{len(names)}")
            problems.extend(f"missing {category} constraint: {name}" for name in missing)

        triggers = set(connection.execute(text("""
            SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
        """)).scalars())
        print("\nTriggers")
        for trigger in REQUIRED_TRIGGERS:
            ok = trigger in triggers
            print(f"  {'✓' if ok else '✗'} {trigger}")
            if not ok:
                problems.append(f"missing trigger: {trigger}")

        views = set(connection.execute(text("""
            SELECT viewname FROM pg_views WHERE schemaname = 'public'
        """)).scalars())
        print("\nViews")
        for view in REQUIRED_VIEWS:
            ok = view in views
            print(f"  {'✓' if ok else '✗'} {view}")
            if not ok:
                problems.append(f"missing view: {view}")

        indexes = set(connection.execute(text("""
            SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
        """)).scalars())
        print("\nIndexes")
        for index in REQUIRED_INDEXES:
            ok = index in indexes
            print(f"  {'✓' if ok else '✗'} {index}")
            if not ok:
                problems.append(f"missing index: {index}")

        print("\nReferential integrity spot checks")
        orphan_students = connection.execute(text("""
            SELECT count(*) FROM student s
             WHERE s.department_id IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM department d WHERE d.department_id = s.department_id)
        """)).scalar()
        orphan_enrollments = connection.execute(text("""
            SELECT count(*) FROM enrollment e
             WHERE NOT EXISTS (SELECT 1 FROM student s WHERE s.student_id = e.student_id)
                OR NOT EXISTS (SELECT 1 FROM course_offering o WHERE o.offering_id = e.offering_id)
        """)).scalar()
        overfull = connection.execute(text("""
            SELECT count(*) FROM (
                SELECT o.offering_id
                  FROM course_offering o
                  LEFT JOIN enrollment e
                    ON e.offering_id = o.offering_id AND e.enrollment_status <> 'Dropped'
                 GROUP BY o.offering_id, o.capacity
                HAVING count(e.enrollment_id) > o.capacity
            ) AS over_capacity
        """)).scalar()
        print(f"  {'✓' if orphan_students == 0 else '✗'} students without a valid department: {orphan_students}")
        print(f"  {'✓' if orphan_enrollments == 0 else '✗'} enrollments without student/offering: {orphan_enrollments}")
        print(f"  {'✓' if overfull == 0 else '✗'} offerings over capacity: {overfull}")
        if orphan_students or orphan_enrollments or overfull:
            problems.append("referential integrity check failed")

    print()
    if problems:
        print(f"FAILED — {len(problems)} problem(s):")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print("All database checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
