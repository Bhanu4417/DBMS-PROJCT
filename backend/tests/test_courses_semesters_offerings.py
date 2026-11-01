"""Course, semester and course-offering tests."""
from __future__ import annotations

NEW_COURSE = {
    "course_code": "CSE-401",
    "course_name": "Operating Systems",
    "credits": 4,
    "department_id": 1,
    "description": "Processes, memory and file systems.",
}


# --------------------------------------------------------------------------- #
# Courses
# --------------------------------------------------------------------------- #
def test_course_crud(client):
    created = client.post("/api/courses", json=NEW_COURSE)
    assert created.status_code == 201, created.text
    course_id = created.json()["course_id"]

    updated = client.put(f"/api/courses/{course_id}", json={"credits": 3})
    assert updated.status_code == 200
    assert updated.json()["credits"] == 3

    assert client.delete(f"/api/courses/{course_id}").status_code == 200


def test_course_credits_must_be_between_1_and_6(client):
    for credits in (0, 7, -3):
        response = client.post("/api/courses", json={**NEW_COURSE, "credits": credits})
        assert response.status_code == 422
        assert any(error["field"] == "credits" for error in response.json()["errors"])


def test_course_code_must_be_unique(client):
    assert client.post("/api/courses", json=NEW_COURSE).status_code == 201
    duplicate = client.post("/api/courses", json={**NEW_COURSE, "course_name": "Another"})
    assert duplicate.status_code == 409
    assert "course code" in duplicate.json()["detail"].lower()


def test_course_requires_department(client):
    assert client.post("/api/courses", json={**NEW_COURSE, "department_id": 999}).status_code == 404


def test_course_detail_lists_offerings(client):
    body = client.get("/api/courses/1").json()
    assert body["offerings"][0]["section"] == "A"
    assert body["offerings"][0]["capacity"] == 2
    assert body["offerings"][0]["enrolled"] == 1


def test_course_delete_blocked_when_offered(client):
    response = client.delete("/api/courses/1")
    assert response.status_code == 409
    assert "offering" in response.json()["detail"].lower()


# --------------------------------------------------------------------------- #
# Semesters
# --------------------------------------------------------------------------- #
NEW_SEMESTER = {
    "semester_name": "Summer Term",
    "academic_year": "2025-2026",
    "start_date": "2025-06-01",
    "end_date": "2025-07-31",
    "status": "Upcoming",
}


def test_semester_crud(client):
    created = client.post("/api/semesters", json=NEW_SEMESTER)
    assert created.status_code == 201, created.text
    semester_id = created.json()["semester_id"]

    updated = client.put(f"/api/semesters/{semester_id}", json={"status": "Active"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "Active"

    assert client.delete(f"/api/semesters/{semester_id}").status_code == 200


def test_semester_end_date_must_follow_start(client):
    response = client.post(
        "/api/semesters",
        json={**NEW_SEMESTER, "start_date": "2025-08-01", "end_date": "2025-07-01"},
    )
    assert response.status_code == 422

    created = client.post("/api/semesters", json=NEW_SEMESTER).json()
    invalid_update = client.put(
        f"/api/semesters/{created['semester_id']}", json={"end_date": "2025-05-01"}
    )
    assert invalid_update.status_code == 400


def test_semester_name_and_year_combination_unique(client):
    assert client.post("/api/semesters", json=NEW_SEMESTER).status_code == 201
    duplicate = client.post("/api/semesters", json=NEW_SEMESTER)
    assert duplicate.status_code == 409
    assert "semester" in duplicate.json()["detail"].lower()


def test_semester_options_and_offerings(client):
    options = client.get("/api/semesters/options").json()
    assert len(options) == 2
    offerings = client.get("/api/semesters/1/offerings").json()
    assert {offering["capacity"] for offering in offerings} == {2, 30}


# --------------------------------------------------------------------------- #
# Course offerings
# --------------------------------------------------------------------------- #
NEW_OFFERING = {"course_id": 1, "semester_id": 2, "section": "A", "capacity": 40}


def test_offering_crud(client):
    created = client.post("/api/offerings", json=NEW_OFFERING)
    assert created.status_code == 201, created.text
    offering_id = created.json()["offering_id"]

    updated = client.put(f"/api/offerings/{offering_id}", json={"capacity": 45})
    assert updated.status_code == 200
    assert updated.json()["capacity"] == 45

    assert client.delete(f"/api/offerings/{offering_id}").status_code == 200


def test_offering_unique_course_semester_section(client):
    assert client.post("/api/offerings", json=NEW_OFFERING).status_code == 201
    duplicate = client.post("/api/offerings", json=NEW_OFFERING)
    assert duplicate.status_code == 409
    assert "section" in duplicate.json()["detail"].lower()


def test_offering_capacity_must_be_positive(client):
    assert client.post("/api/offerings", json={**NEW_OFFERING, "capacity": 0}).status_code == 422
    assert client.post("/api/offerings", json={**NEW_OFFERING, "capacity": -5}).status_code == 422


def test_offering_requires_course_and_semester(client):
    assert client.post("/api/offerings", json={**NEW_OFFERING, "course_id": 999}).status_code == 404
    assert client.post("/api/offerings", json={**NEW_OFFERING, "semester_id": 999}).status_code == 404


def test_offering_detail_shows_students_and_faculty(client):
    body = client.get("/api/offerings/1").json()
    assert body["course_code"] == "CSE-301"
    assert body["enrolled"] == 1
    assert body["seats_available"] == 1
    assert body["faculty_names"] == "Meera Iyer"
    assert body["students"][0]["student_name"] == "Aarav Sharma"
    assert body["faculty"][0]["employee_code"] == "FAC-1001"


def test_offering_delete_blocked_with_enrollments(client):
    response = client.delete("/api/offerings/1")
    assert response.status_code == 409
    assert "enrollment" in response.json()["detail"].lower()
