"""Prove that constraints are enforced by PostgreSQL itself, not only by the API.

Each test talks straight to the database, bypassing FastAPI entirely.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, IntegrityError


def execute(engine, statement: str, **params):
    with engine.begin() as connection:
        return connection.execute(text(statement), params)


def test_primary_keys_exist_on_all_nine_tables(db):
    rows = db.execute(text("""
        SELECT c.relname
          FROM pg_constraint con
          JOIN pg_class c ON c.oid = con.conrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE con.contype = 'p' AND n.nspname = 'public'
    """)).scalars().all()
    assert {
        "department", "student", "faculty", "course", "semester",
        "course_offering", "faculty_assignment", "enrollment", "grade",
    } <= set(rows)


def test_foreign_keys_exist_between_related_tables(db):
    rows = db.execute(text("""
        SELECT conname FROM pg_constraint WHERE contype = 'f'
    """)).scalars().all()
    assert {
        "fk_student_department", "fk_faculty_department", "fk_course_department",
        "fk_offering_course", "fk_offering_semester", "fk_assignment_faculty",
        "fk_assignment_offering", "fk_enrollment_student", "fk_enrollment_offering",
        "fk_grade_enrollment",
    } <= set(rows)


def test_unique_and_check_constraints_exist(db):
    rows = db.execute(text("""
        SELECT conname, contype FROM pg_constraint
         WHERE contype IN ('u', 'c') AND conname LIKE 'ck_%' OR conname LIKE 'uq_%'
    """)).all()
    names = {row[0] for row in rows}
    assert {
        "uq_student_enrollment_number", "uq_student_email", "uq_faculty_employee_code",
        "uq_course_code", "uq_department_code", "uq_enrollment_student_offering",
        "uq_assignment_faculty_offering", "uq_grade_enrollment",
        "ck_course_credits", "ck_offering_capacity", "ck_semester_dates",
        "ck_student_status", "ck_semester_status", "ck_enrollment_status",
        "ck_grade_marks_within_max", "ck_grade_letter",
    } <= names


def test_duplicate_enrollment_number_rejected_by_database(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO student (enrollment_number, first_name, last_name, email, admission_year)
            VALUES ('ENR2023001', 'Clone', 'Student', 'clone@test.edu.in', 2023)
        """)
    assert "uq_student_enrollment_number" in str(error.value)


def test_foreign_key_violation_rejected_by_database(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO enrollment (student_id, offering_id) VALUES (999, 1)
        """)
    assert "fk_enrollment_student" in str(error.value)


def test_check_constraint_rejected_by_database(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO course (course_code, course_name, credits, department_id)
            VALUES ('CSE-999', 'Impossible Course', 9, 1)
        """)
    assert "ck_course_credits" in str(error.value)


def test_not_null_constraint_rejected_by_database(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO faculty (employee_code, first_name, last_name, email, department_id)
            VALUES ('FAC-9999', 'No', 'Department', 'nodep@test.edu.in', NULL)
        """)
    assert "department_id" in str(error.value)


def test_grade_marks_cannot_exceed_maximum(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO grade (enrollment_id, marks_obtained, max_marks)
            VALUES (2, 120, 100)
        """)
    assert "ck_grade_marks_within_max" in str(error.value)


def test_one_grade_per_enrollment(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO grade (enrollment_id, marks_obtained, max_marks)
            VALUES (1, 50, 100)
        """)
    assert "uq_grade_enrollment" in str(error.value)


def test_capacity_trigger_blocks_direct_sql(engine):
    """Even a raw INSERT cannot overfill an offering (capacity 2, one seat left)."""
    execute(engine, "INSERT INTO enrollment (student_id, offering_id) VALUES (2, 1)")
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, "INSERT INTO enrollment (student_id, offering_id) VALUES (3, 1)")
    assert "full capacity" in str(error.value)

    # A dropped seat does not count, so the same insert succeeds afterwards.
    execute(engine, """
        UPDATE enrollment SET enrollment_status = 'Dropped' WHERE enrollment_id = 1
    """)
    execute(engine, "INSERT INTO enrollment (student_id, offering_id) VALUES (3, 1)")


def test_capacity_cannot_be_reduced_below_enrolled_count(engine):
    execute(engine, "INSERT INTO enrollment (student_id, offering_id) VALUES (2, 1)")
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, "UPDATE course_offering SET capacity = 1 WHERE offering_id = 1")
    assert "below the" in str(error.value)


def test_semester_date_check(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, """
            INSERT INTO semester (semester_name, academic_year, start_date, end_date)
            VALUES ('Broken', '2025-2026', DATE '2025-08-01', DATE '2025-07-01')
        """)
    assert "ck_semester_dates" in str(error.value)


def test_restrict_delete_keeps_academic_history(engine):
    with pytest.raises((IntegrityError, DBAPIError)) as error:
        execute(engine, "DELETE FROM department WHERE department_id = 1")
    assert "fk_" in str(error.value)
    assert execute(engine, "SELECT count(*) FROM department").scalar() == 2


def test_views_return_joined_rows(engine):
    with engine.connect() as connection:
        row = connection.execute(text("""
            SELECT student_name, course_code, grade_letter
              FROM v_enrollment_details WHERE enrollment_id = 1
        """)).mappings().one()
        assert row["student_name"] == "Aarav Sharma"
        assert row["course_code"] == "CSE-301"
        assert row["grade_letter"] == "A"
        utilisation = connection.execute(text(
            "SELECT utilisation_percent FROM v_offering_utilization WHERE offering_id = 1"
        )).scalar()
        assert float(utilisation) == 50.0


def test_indexes_support_common_filters(db):
    names = db.execute(text(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'"
    )).scalars().all()
    assert {
        "idx_student_department", "idx_enrollment_offering", "idx_faculty_department",
        "idx_offering_semester", "idx_enrollment_student",
    } <= set(names)
