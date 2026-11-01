"""Student CRUD, filtering, pagination and referential-integrity tests."""
from __future__ import annotations

VALID_STUDENT = {
    "enrollment_number": "ENR2025010",
    "first_name": "Kabir",
    "last_name": "Nair",
    "email": "kabir.nair@test.edu.in",
    "phone": "9876500999",
    "date_of_birth": "2006-03-15",
    "gender": "Male",
    "admission_year": 2025,
    "department_id": 1,
    "status": "Active",
}


def test_list_students_returns_page_envelope(client):
    response = client.get("/api/students")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3
    assert {"items", "total", "page", "page_size", "pages"} <= body.keys()


def test_search_and_filter_students(client):
    assert client.get("/api/students?search=aarav").json()["total"] == 1
    assert client.get("/api/students?search=ENR2023").json()["total"] == 2
    assert client.get("/api/students?department_id=2").json()["total"] == 1
    assert client.get("/api/students?status=Graduated").json()["total"] == 1
    assert client.get("/api/students?admission_year=2023").json()["total"] == 2


def test_sort_and_paginate_students(client):
    ascending = client.get("/api/students?sort_by=admission_year&sort_dir=asc&page_size=1").json()
    descending = client.get("/api/students?sort_by=admission_year&sort_dir=desc&page_size=1").json()
    assert ascending["items"][0]["admission_year"] == 2023
    assert descending["items"][0]["admission_year"] == 2024
    assert ascending["pages"] == 3
    second_page = client.get("/api/students?page=2&page_size=2").json()
    assert second_page["page"] == 2 and len(second_page["items"]) == 1


def test_create_student(client):
    response = client.post("/api/students", json=VALID_STUDENT)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["student_id"] > 3
    assert body["email"] == VALID_STUDENT["email"]
    assert client.get("/api/students").json()["total"] == 4


def test_duplicate_enrollment_number_and_email_rejected(client):
    client.post("/api/students", json=VALID_STUDENT)
    duplicate_enrollment = client.post(
        "/api/students", json={**VALID_STUDENT, "email": "other@test.edu.in"}
    )
    assert duplicate_enrollment.status_code == 409
    assert "enrollment number" in duplicate_enrollment.json()["detail"].lower()

    duplicate_email = client.post(
        "/api/students", json={**VALID_STUDENT, "enrollment_number": "ENR2025011"}
    )
    assert duplicate_email.status_code == 409
    assert "email" in duplicate_email.json()["detail"].lower()


def test_invalid_student_payload_rejected(client):
    missing = client.post("/api/students", json={"first_name": "NoEmail"})
    assert missing.status_code == 422
    assert {error["field"] for error in missing.json()["errors"]} >= {
        "enrollment_number",
        "last_name",
        "email",
        "admission_year",
    }

    bad_year = client.post("/api/students", json={**VALID_STUDENT, "admission_year": 1990})
    assert bad_year.status_code == 422

    bad_email = client.post("/api/students", json={**VALID_STUDENT, "email": "not-an-email"})
    assert bad_email.status_code == 422

    bad_gender = client.post("/api/students", json={**VALID_STUDENT, "gender": "Unknown"})
    assert bad_gender.status_code == 422


def test_unknown_department_is_rejected(client):
    response = client.post("/api/students", json={**VALID_STUDENT, "department_id": 999})
    assert response.status_code == 404
    assert "department" in response.json()["detail"].lower()


def test_update_student(client):
    response = client.put("/api/students/1", json={"status": "Inactive", "phone": "9000000000"})
    assert response.status_code == 200
    assert response.json()["status"] == "Inactive"
    assert client.get("/api/students/1").json()["phone"] == "9000000000"


def test_student_detail_includes_academic_history(client):
    body = client.get("/api/students/1").json()
    assert body["department_name"] == "Computer Science and Engineering"
    assert len(body["enrollments"]) == 1
    record = body["enrollments"][0]
    assert record["course_code"] == "CSE-301"
    assert record["grade_letter"] == "A"
    assert record["credits"] == 4


def test_delete_student_with_history_is_blocked(client):
    response = client.delete("/api/students/1")
    assert response.status_code == 409
    assert "enrollment" in response.json()["detail"].lower()
    assert client.get("/api/students/1").status_code == 200


def test_delete_student_without_history_succeeds(client):
    created = client.post("/api/students", json=VALID_STUDENT).json()
    response = client.delete(f"/api/students/{created['student_id']}")
    assert response.status_code == 200
    assert client.get(f"/api/students/{created['student_id']}").status_code == 404


def test_missing_student_returns_404(client):
    assert client.get("/api/students/9999").status_code == 404
    assert client.put("/api/students/9999", json={"status": "Active"}).status_code == 404
    assert client.delete("/api/students/9999").status_code == 404
