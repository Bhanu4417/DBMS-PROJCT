"""Faculty assignment, enrollment (including capacity) and grade tests."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest


# --------------------------------------------------------------------------- #
# Faculty assignments
# --------------------------------------------------------------------------- #
def test_assignment_list_uses_joins(client):
    items = client.get("/api/assignments").json()["items"]
    assert items[0]["faculty_name"] == "Meera Iyer"
    assert items[0]["course_code"] == "CSE-301"
    assert items[0]["department_name"] == "Computer Science and Engineering"


def test_assignment_crud(client):
    created = client.post("/api/assignments", json={"faculty_id": 1, "offering_id": 2})
    assert created.status_code == 201, created.text
    assignment_id = created.json()["assignment_id"]
    assert created.json()["faculty_name"] == "Meera Iyer"

    updated = client.put(f"/api/assignments/{assignment_id}", json={"offering_id": 1, "faculty_id": 2})
    assert updated.status_code == 200
    assert updated.json()["faculty_name"] == "Sandeep Rao"
    assert updated.json()["offering_id"] == 1

    assert client.delete(f"/api/assignments/{assignment_id}").status_code == 200


def test_duplicate_assignment_rejected(client):
    first = client.post("/api/assignments", json={"faculty_id": 1, "offering_id": 1})
    assert first.status_code == 409
    assert "already assigned" in first.json()["detail"].lower()


def test_assignment_requires_existing_records(client):
    assert client.post("/api/assignments", json={"faculty_id": 99, "offering_id": 1}).status_code == 404
    assert client.post("/api/assignments", json={"faculty_id": 1, "offering_id": 99}).status_code == 404


# --------------------------------------------------------------------------- #
# Enrollments
# --------------------------------------------------------------------------- #
def test_enrollment_list_uses_joins(client):
    items = client.get("/api/enrollments").json()["items"]
    assert items[0]["student_name"]
    assert items[0]["course_code"]
    assert items[0]["semester_name"]


def test_enroll_student(client):
    response = client.post("/api/enrollments", json={"student_id": 3, "offering_id": 2})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["enrollment_status"] == "Enrolled"
    assert client.get("/api/enrollments?student_id=3").json()["total"] == 1


def test_duplicate_enrollment_rejected(client):
    response = client.post("/api/enrollments", json={"student_id": 1, "offering_id": 1})
    assert response.status_code == 409
    assert "already enrolled" in response.json()["detail"].lower()


def test_capacity_is_enforced(client):
    # Offering 1 has capacity 2 and one active enrollment.
    assert client.post("/api/enrollments", json={"student_id": 2, "offering_id": 1}).status_code == 201
    overflow = client.post("/api/enrollments", json={"student_id": 3, "offering_id": 1})
    assert overflow.status_code == 409
    assert "full" in overflow.json()["detail"].lower()


def test_dropped_enrollment_frees_a_seat(client):
    client.post("/api/enrollments", json={"student_id": 2, "offering_id": 1})
    blocked = client.post("/api/enrollments", json={"student_id": 3, "offering_id": 1})
    assert blocked.status_code == 409

    enrollment_id = client.get("/api/enrollments?student_id=2&offering_id=1").json()["items"][0][
        "enrollment_id"
    ]
    dropped = client.put(f"/api/enrollments/{enrollment_id}", json={"enrollment_status": "Dropped"})
    assert dropped.status_code == 200

    assert client.post("/api/enrollments", json={"student_id": 3, "offering_id": 1}).status_code == 201


def test_reactivating_dropped_enrollment_respects_capacity(client):
    client.post("/api/enrollments", json={"student_id": 2, "offering_id": 1})
    enrollment_id = client.get("/api/enrollments?student_id=2&offering_id=1").json()["items"][0][
        "enrollment_id"
    ]
    client.put(f"/api/enrollments/{enrollment_id}", json={"enrollment_status": "Dropped"})
    client.post("/api/enrollments", json={"student_id": 3, "offering_id": 1})

    reactivate = client.put(
        f"/api/enrollments/{enrollment_id}", json={"enrollment_status": "Enrolled"}
    )
    assert reactivate.status_code == 409


def test_invalid_enrollment_status_rejected(client):
    response = client.put("/api/enrollments/1", json={"enrollment_status": "Pending"})
    assert response.status_code == 422


def test_enrollment_requires_existing_records(client):
    assert client.post("/api/enrollments", json={"student_id": 99, "offering_id": 1}).status_code == 404
    assert client.post("/api/enrollments", json={"student_id": 1, "offering_id": 99}).status_code == 404


def test_delete_enrollment_blocked_by_grade(client):
    response = client.delete("/api/enrollments/1")
    assert response.status_code == 409
    assert "grade" in response.json()["detail"].lower()


def test_delete_enrollment_without_grade(client):
    assert client.delete("/api/enrollments/2").status_code == 200


def test_concurrent_enrollments_never_exceed_capacity(client):
    """Two simultaneous requests for the last seat: exactly one must win."""
    # Offering 1: capacity 2, currently 1 active enrollment -> one free seat.
    barrier = threading.Barrier(2)

    def attempt(student_id: int):
        barrier.wait()
        response = client.post("/api/enrollments", json={"student_id": student_id, "offering_id": 1})
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, [2, 3]))

    assert sorted(results) == [201, 409], results
    active = client.get("/api/enrollments?offering_id=1").json()["items"]
    assert len([item for item in active if item["enrollment_status"] != "Dropped"]) == 2


# --------------------------------------------------------------------------- #
# Grades
# --------------------------------------------------------------------------- #
def test_grade_list_uses_joins(client):
    items = client.get("/api/grades").json()["items"]
    assert items[0]["student_name"] == "Aarav Sharma"
    assert items[0]["course_code"] == "CSE-301"
    assert float(items[0]["percentage"]) == 80.0


def test_grade_crud(client):
    created = client.post(
        "/api/grades", json={"enrollment_id": 2, "marks_obtained": 72, "max_marks": 100,
                             "grade_letter": "B+"}
    )
    assert created.status_code == 201, created.text
    grade_id = created.json()["grade_id"]

    updated = client.put(f"/api/grades/{grade_id}", json={"marks_obtained": 91, "grade_letter": "A+"})
    assert updated.status_code == 200
    assert updated.json()["grade_letter"] == "A+"

    assert client.delete(f"/api/grades/{grade_id}").status_code == 200


def test_only_one_grade_per_enrollment(client):
    duplicate = client.post(
        "/api/grades", json={"enrollment_id": 1, "marks_obtained": 60, "max_marks": 100}
    )
    assert duplicate.status_code == 409
    assert "grade" in duplicate.json()["detail"].lower()


def test_grade_validation(client):
    assert (
        client.post(
            "/api/grades", json={"enrollment_id": 2, "marks_obtained": 120, "max_marks": 100}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/grades", json={"enrollment_id": 2, "marks_obtained": -1, "max_marks": 100}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/grades",
            json={"enrollment_id": 2, "marks_obtained": 10, "max_marks": 100, "grade_letter": "Z"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/grades", json={"enrollment_id": 2, "marks_obtained": 10, "max_marks": 0}
        ).status_code
        == 422
    )


def test_grade_requires_existing_enrollment(client):
    assert (
        client.post("/api/grades", json={"enrollment_id": 999, "max_marks": 100}).status_code == 404
    )
