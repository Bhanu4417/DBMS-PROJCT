"""Department and faculty CRUD tests."""
from __future__ import annotations

NEW_DEPARTMENT = {
    "department_code": "ME",
    "department_name": "Mechanical Engineering",
    "office_location": "Block C",
}

NEW_FACULTY = {
    "employee_code": "FAC-2001",
    "first_name": "Anita",
    "last_name": "Desai",
    "email": "anita.desai@test.edu.in",
    "phone": "9876511111",
    "designation": "Associate Professor",
    "joining_date": "2018-07-01",
    "department_id": 1,
}


# --------------------------------------------------------------------------- #
# Departments
# --------------------------------------------------------------------------- #
def test_department_list_includes_live_counts(client):
    items = client.get("/api/departments").json()["items"]
    cse = next(item for item in items if item["department_code"] == "CSE")
    assert cse["student_count"] == 2
    assert cse["faculty_count"] == 1
    assert cse["course_count"] == 1


def test_department_crud(client):
    created = client.post("/api/departments", json=NEW_DEPARTMENT)
    assert created.status_code == 201, created.text
    department_id = created.json()["department_id"]

    updated = client.put(
        f"/api/departments/{department_id}", json={"office_location": "Block C, Room 2"}
    )
    assert updated.status_code == 200
    assert updated.json()["office_location"] == "Block C, Room 2"

    assert client.delete(f"/api/departments/{department_id}").status_code == 200
    assert client.get(f"/api/departments/{department_id}").status_code == 404


def test_department_duplicate_and_format_validation(client):
    assert client.post("/api/departments", json=NEW_DEPARTMENT).status_code == 201
    assert client.post("/api/departments", json=NEW_DEPARTMENT).status_code == 409
    assert (
        client.post(
            "/api/departments",
            json={"department_code": "lower", "department_name": "Lowercase Code"},
        ).status_code
        == 422
    )


def test_department_delete_blocked_by_dependents(client):
    response = client.delete("/api/departments/1")
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "student(s)" in detail and "faculty member(s)" in detail


def test_department_search_and_options(client):
    assert client.get("/api/departments?search=electronics").json()["total"] == 1
    options = client.get("/api/departments/options").json()
    assert {(option["value"], option["label"]) for option in options} == {
        (1, "Computer Science and Engineering"),
        (2, "Electronics and Communication Engineering"),
    }


# --------------------------------------------------------------------------- #
# Faculty
# --------------------------------------------------------------------------- #
def test_faculty_list_with_department_name(client):
    items = client.get("/api/faculty").json()["items"]
    assert items[0]["department_name"]
    assert client.get("/api/faculty?department_id=2").json()["total"] == 1


def test_faculty_crud(client):
    created = client.post("/api/faculty", json=NEW_FACULTY)
    assert created.status_code == 201, created.text
    faculty_id = created.json()["faculty_id"]

    updated = client.put(f"/api/faculty/{faculty_id}", json={"designation": "Professor"})
    assert updated.status_code == 200
    assert updated.json()["designation"] == "Professor"

    assert client.delete(f"/api/faculty/{faculty_id}").status_code == 200


def test_faculty_unique_constraints(client):
    assert client.post("/api/faculty", json=NEW_FACULTY).status_code == 201
    duplicate_code = client.post(
        "/api/faculty", json={**NEW_FACULTY, "email": "unique.code@test.edu.in"}
    )
    assert duplicate_code.status_code == 409
    assert "employee code" in duplicate_code.json()["detail"].lower()


def test_faculty_requires_existing_department(client):
    response = client.post("/api/faculty", json={**NEW_FACULTY, "department_id": 404})
    assert response.status_code == 404


def test_faculty_detail_lists_assignments(client):
    body = client.get("/api/faculty/1").json()
    assert len(body["assignments"]) == 1
    assert body["assignments"][0]["course_code"] == "CSE-301"


def test_faculty_delete_blocked_when_assigned(client):
    response = client.delete("/api/faculty/1")
    assert response.status_code == 409
    assert "assignment" in response.json()["detail"].lower()
