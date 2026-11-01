"""Pytest fixtures — every test runs against a dedicated ``college_test`` database.

The development database is never touched: the test URL is read from
``TEST_DATABASE_URL`` and the schema is rebuilt before the suite starts.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
import pytest
from sqlalchemy import text
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:55432/college_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.database import get_db  # noqa: E402  (must run after DATABASE_URL is set)
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

SCHEMA = (ROOT.parent / "database" / "schema.sql").read_text()

FIXTURE_SQL = """
TRUNCATE grade, enrollment, faculty_assignment, course_offering, semester, course,
         faculty, student, department RESTART IDENTITY CASCADE;

INSERT INTO department (department_id, department_code, department_name, office_location) VALUES
    (1, 'CSE', 'Computer Science and Engineering', 'Block A'),
    (2, 'ECE', 'Electronics and Communication Engineering', 'Block B');

INSERT INTO student (student_id, enrollment_number, first_name, last_name, email,
                     phone, date_of_birth, gender, admission_year, department_id, status) VALUES
    (1, 'ENR2023001', 'Aarav', 'Sharma', 'aarav.sharma@test.edu.in', '9876543210',
     DATE '2005-04-12', 'Male', 2023, 1, 'Active'),
    (2, 'ENR2023002', 'Diya', 'Patel', 'diya.patel@test.edu.in', '9876543211',
     DATE '2005-08-19', 'Female', 2023, 2, 'Active'),
    (3, 'ENR2024003', 'Rohan', 'Verma', 'rohan.verma@test.edu.in', '9876543212',
     DATE '2006-02-02', 'Male', 2024, 1, 'Graduated');

INSERT INTO faculty (faculty_id, employee_code, first_name, last_name, email, phone,
                     designation, joining_date, department_id) VALUES
    (1, 'FAC-1001', 'Meera', 'Iyer', 'meera.iyer@test.edu.in', '9876500001',
     'Professor', DATE '2015-06-01', 1),
    (2, 'FAC-1002', 'Sandeep', 'Rao', 'sandeep.rao@test.edu.in', '9876500002',
     'Assistant Professor', DATE '2019-07-15', 2);

INSERT INTO course (course_id, course_code, course_name, credits, department_id, description) VALUES
    (1, 'CSE-301', 'Database Management Systems', 4, 1, 'Relational design and SQL'),
    (2, 'ECE-202', 'Digital Logic Design', 3, 2, 'Combinational and sequential logic');

INSERT INTO semester (semester_id, semester_name, academic_year, start_date, end_date, status) VALUES
    (1, 'Odd Semester', '2024-2025', DATE '2024-07-22', DATE '2024-12-13', 'Active'),
    (2, 'Even Semester', '2024-2025', DATE '2025-01-06', DATE '2025-05-23', 'Upcoming');

INSERT INTO course_offering (offering_id, course_id, semester_id, section, capacity) VALUES
    (1, 1, 1, 'A', 2),
    (2, 2, 1, 'A', 30);

INSERT INTO faculty_assignment (assignment_id, faculty_id, offering_id) VALUES
    (1, 1, 1),
    (2, 2, 2);

INSERT INTO enrollment (enrollment_id, student_id, offering_id, enrollment_date, enrollment_status) VALUES
    (1, 1, 1, DATE '2024-07-25', 'Enrolled'),
    (2, 2, 2, DATE '2024-07-25', 'Enrolled');

INSERT INTO grade (grade_id, enrollment_id, marks_obtained, max_marks, grade_letter) VALUES
    (1, 1, 80.00, 100.00, 'A');

SELECT setval(pg_get_serial_sequence('department', 'department_id'), 2);
SELECT setval(pg_get_serial_sequence('student', 'student_id'), 3);
SELECT setval(pg_get_serial_sequence('faculty', 'faculty_id'), 2);
SELECT setval(pg_get_serial_sequence('course', 'course_id'), 2);
SELECT setval(pg_get_serial_sequence('semester', 'semester_id'), 2);
SELECT setval(pg_get_serial_sequence('course_offering', 'offering_id'), 2);
SELECT setval(pg_get_serial_sequence('faculty_assignment', 'assignment_id'), 2);
SELECT setval(pg_get_serial_sequence('enrollment', 'enrollment_id'), 2);
SELECT setval(pg_get_serial_sequence('grade', 'grade_id'), 1);
"""


def _dsn(url: str, database: str | None = None) -> str:
    dsn = url.replace("postgresql+psycopg://", "postgresql://")
    if database:
        dsn = dsn.rsplit("/", 1)[0] + "/" + database
    return dsn


def _ensure_database() -> None:
    name = TEST_DATABASE_URL.rsplit("/", 1)[1]
    with psycopg.connect(_dsn(TEST_DATABASE_URL, "postgres"), autocommit=True) as connection:
        exists = connection.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (name,)
        ).fetchone()
        if not exists:
            connection.execute(f'CREATE DATABASE "{name}"')


def _run_script(script: str) -> None:
    """Run a multi-statement SQL script without parameter interpolation.

    psycopg only processes ``%`` placeholders when parameters are supplied, so
    PL/pgSQL RAISE format strings stay intact.
    """
    with psycopg.connect(_dsn(TEST_DATABASE_URL), autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(script)


@pytest.fixture(scope="session")
def engine():
    _ensure_database()
    _run_script(SCHEMA)
    test_engine = create_engine(TEST_DATABASE_URL, future=True)
    yield test_engine
    test_engine.dispose()


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def clean_database(engine):
    """Reset the data to the known fixture before every test."""
    _run_script(FIXTURE_SQL)
    yield


@pytest.fixture
def db(session_factory):
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(session_factory):
    def override_get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
