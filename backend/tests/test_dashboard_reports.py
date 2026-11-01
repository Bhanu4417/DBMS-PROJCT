"""Dashboard statistics, charts, reports and CSV export tests."""
from __future__ import annotations


def test_dashboard_stats_are_live_counts(client):
    body = client.get("/api/dashboard/stats").json()
    assert body["total_students"] == 3
    assert body["total_faculty"] == 2
    assert body["total_departments"] == 2
    assert body["total_courses"] == 2
    assert body["active_enrollments"] == 2
    assert body["active_semesters"] == 1

    client.post("/api/students", json={
        "enrollment_number": "ENR2025099", "first_name": "New", "last_name": "Student",
        "email": "new.student@test.edu.in", "admission_year": 2025, "department_id": 1,
    })
    assert client.get("/api/dashboard/stats").json()["total_students"] == 4


def test_dashboard_charts_shape_and_values(client):
    body = client.get("/api/dashboard/charts").json()
    assert set(body) == {
        "students_by_department", "admissions_by_year", "enrollment_distribution",
        "offerings_by_semester",
    }
    by_department = {row["name"]: row["value"] for row in body["students_by_department"]}
    assert by_department == {"CSE": 2, "ECE": 1}
    assert {row["name"] for row in body["enrollment_distribution"]} == {"Enrolled"}
    assert sum(row["value"] for row in body["offerings_by_semester"]) == 2


def test_dashboard_activity_sections(client):
    body = client.get("/api/dashboard/activity").json()
    assert len(body["recent_students"]) == 3
    assert len(body["recent_enrollments"]) == 2
    assert body["popular_courses"]
    assert len(body["department_overview"]) == 2


def test_student_report_sections(client):
    body = client.get("/api/reports/students").json()
    assert {row["department_code"] for row in body["by_department"]} == {"CSE", "ECE"}
    assert sum(row["students"] for row in body["by_admission_year"]) == 3
    assert {row["status"] for row in body["by_status"]} == {"Active", "Graduated"}


def test_faculty_report(client):
    body = client.get("/api/reports/faculty").json()
    assert len(body["by_department"]) == 2
    assert len(body["assignments"]) == 2


def test_academic_report(client):
    body = client.get("/api/reports/academic").json()
    assert body["course_enrollment"][0]["enrolled"] >= 1
    assert body["capacity_utilization"][0]["capacity"] == 2
    assert body["grade_distribution"] == [{"name": "A", "value": 1}]
    assert len(body["semester_summary"]) == 2
    assert body["student_grades"][0]["grade_letter"] == "A"


def test_csv_export_headers_and_content(client):
    response = client.get("/api/reports/export?report=students-by-department")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.strip().splitlines()
    assert lines[0] == "department_code,department_name,students"
    assert any(line.startswith("CSE,Computer Science") for line in lines)


def test_unknown_export_report_returns_404(client):
    assert client.get("/api/reports/export?report=not-a-report").status_code == 404


def test_health_endpoint(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "connected"
