#!/usr/bin/env python3
"""Generate database/seed.sql — deterministic, rerunnable sample data.

The generated file uses explicit primary keys and ``ON CONFLICT DO NOTHING``,
so running it twice never creates duplicates and never breaks foreign keys.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

random.seed(20240517)  # fixed seed => identical seed.sql on every run

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "database" / "seed.sql"

DEPARTMENTS = [
    ("CSE", "Computer Science and Engineering", "Block A, Room 101"),
    ("ECE", "Electronics and Communication Engineering", "Block B, Room 204"),
    ("ME", "Mechanical Engineering", "Block C, Room 118"),
    ("EE", "Electrical Engineering", "Block D, Room 210"),
    ("CIV", "Civil Engineering", "Block E, Room 105"),
]

FIRST_NAMES = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan",
    "Krishna", "Ishaan", "Ananya", "Diya", "Aadhya", "Saanvi", "Ira", "Myra",
    "Anika", "Riya", "Neha", "Pooja", "Sneha", "Kavya", "Meera", "Tanvi",
    "Rahul", "Rohan", "Karthik", "Naveen", "Vikram", "Sandeep", "Manish",
    "Pranav", "Shreya", "Nikhil", "Harini", "Divya", "Lakshmi", "Manoj",
    "Swati", "Aishwarya", "Varun", "Tara", "Kabir", "Zoya", "Rehan", "Fatima",
    "Deepak", "Priya", "Anjali", "Suresh",
]
LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Reddy", "Nair", "Iyer", "Gupta", "Singh",
    "Kulkarni", "Menon", "Chatterjee", "Bose", "Rao", "Joshi", "Desai",
    "Mehta", "Pillai", "Kumar", "Naidu", "Shetty", "Bhat", "Chauhan",
    "Ghosh", "Malhotra", "Saxena",
]
DESIGNATIONS = ["Professor", "Associate Professor", "Assistant Professor", "Visiting Faculty"]

COURSE_CATALOG = {
    "CSE": [
        ("CSE-101", "Programming Fundamentals", 4, "C programming, problem solving and lab work."),
        ("CSE-201", "Data Structures", 4, "Arrays, linked lists, trees, graphs and complexity."),
        ("CSE-301", "Database Management Systems", 4, "Relational model, SQL, normalization and transactions."),
        ("CSE-401", "Operating Systems", 3, "Processes, scheduling, memory and file systems."),
    ],
    "ECE": [
        ("ECE-101", "Basic Electronics", 3, "Diodes, transistors and amplifier circuits."),
        ("ECE-202", "Digital Logic Design", 4, "Boolean algebra, combinational and sequential circuits."),
        ("ECE-303", "Signals and Systems", 3, "Continuous and discrete signal analysis."),
        ("ECE-404", "Communication Systems", 4, "Modulation, transmission and receivers."),
    ],
    "ME": [
        ("ME-101", "Engineering Mechanics", 4, "Statics, dynamics and equilibrium of bodies."),
        ("ME-202", "Thermodynamics", 4, "Laws of thermodynamics and power cycles."),
        ("ME-303", "Fluid Mechanics", 3, "Fluid statics, Bernoulli equation and flow measurement."),
        ("ME-401", "Machine Design", 4, "Design of machine elements and failure theories."),
    ],
    "EE": [
        ("EE-101", "Electrical Circuits", 4, "Network theorems, AC and DC circuit analysis."),
        ("EE-202", "Electrical Machines", 4, "Transformers, induction and DC machines."),
        ("EE-303", "Power Systems", 3, "Generation, transmission and distribution basics."),
        ("EE-404", "Control Systems", 4, "Feedback, stability and controller design."),
    ],
    "CIV": [
        ("CIV-101", "Engineering Drawing", 3, "Orthographic projections and building plans."),
        ("CIV-202", "Strength of Materials", 4, "Stress, strain, bending and torsion."),
        ("CIV-303", "Surveying", 3, "Leveling, theodolite and modern surveying tools."),
        ("CIV-401", "Structural Analysis", 4, "Analysis of beams, trusses and frames."),
    ],
}

SEMESTERS = [
    ("Odd Semester", "2023-2024", date(2023, 7, 24), date(2023, 12, 15), "Completed"),
    ("Even Semester", "2023-2024", date(2024, 1, 8), date(2024, 5, 24), "Completed"),
    ("Odd Semester", "2024-2025", date(2024, 7, 22), date(2024, 12, 13), "Active"),
    ("Even Semester", "2024-2025", date(2025, 1, 6), date(2025, 5, 23), "Upcoming"),
]

GENDER_VALUES = ["Female", "Male", "Non-binary", "Prefer not to say"]
STATUS_WEIGHTS = ["Active"] * 8 + ["Graduated"] * 1 + ["Inactive"] * 1


def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, date):
        return f"DATE '{value.isoformat()}'"
    return "'" + str(value).replace("'", "''") + "'"


def insert_block(table: str, columns: list[str], rows: list[tuple], conflict: str = "DO NOTHING") -> str:
    if not rows:
        return ""
    values = ",\n    ".join("(" + ", ".join(q(v) for v in row) + ")" for row in rows)
    return (
        f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n    {values}\n"
        f"ON CONFLICT {conflict};\n\n"
    )


def grade_for(pct: float) -> str:
    if pct >= 90:
        return "A+"
    if pct >= 80:
        return "A"
    if pct >= 70:
        return "B+"
    if pct >= 60:
        return "B"
    if pct >= 50:
        return "C"
    if pct >= 40:
        return "D"
    return "F"


def build() -> str:
    rng = random.Random(7)
    parts: list[str] = []
    parts.append(
        "-- =============================================================================\n"
        "-- CampusOS sample data — 5 departments, 15 faculty, 50 students, 20 courses,\n"
        "-- 4 semesters, 30 offerings, 20 faculty assignments, 100 enrollments, 60 grades.\n"
        "--\n"
        "-- This file is generated by scripts/generate_seed.py and is safe to rerun:\n"
        "-- every insert uses explicit ids with ON CONFLICT DO NOTHING.\n"
        "-- Apply after database/schema.sql:  psql -d college -f database/seed.sql\n"
        "-- =============================================================================\n\n"
        "BEGIN;\n\n"
    )

    parts.append(insert_block(
        "department",
        ["department_id", "department_code", "department_name", "office_location"],
        [(i, code, name, office) for i, (code, name, office) in enumerate(DEPARTMENTS, start=1)],
    ))

    # Faculty: three per department.
    faculty = []
    fid = 0
    used_emails = set()
    for dept_index, (code, _, _) in enumerate(DEPARTMENTS, start=1):
        for slot in range(3):
            fid += 1
            first = FIRST_NAMES[(fid * 5 + slot) % len(FIRST_NAMES)]
            last = LAST_NAMES[(fid * 3 + dept_index) % len(LAST_NAMES)]
            email = f"{first.lower()}.{last.lower()}{fid}@college.edu.in"
            while email in used_emails:
                email = email.replace("@", f".{fid}@")
            used_emails.add(email)
            faculty.append((
                fid, f"FAC-{1000 + fid}", first, last, email,
                f"98{fid:08d}"[:10],
                DESIGNATIONS[(fid + slot) % len(DESIGNATIONS)],
                date(2012 + (fid % 11), 1 + (fid % 12), 1 + (fid % 27)),
                dept_index,
            ))
    parts.append(insert_block(
        "faculty",
        ["faculty_id", "employee_code", "first_name", "last_name", "email", "phone",
         "designation", "joining_date", "department_id"],
        faculty,
    ))

    # Students: 10 per department, spread across four admission years.
    students = []
    used_student_emails = set()
    for sid in range(1, 51):
        dept = (sid - 1) // 10 + 1
        first = FIRST_NAMES[(sid * 3 + 1) % len(FIRST_NAMES)]
        last = LAST_NAMES[(sid * 7 + 2) % len(LAST_NAMES)]
        admission_year = 2021 + ((sid - 1) % 4)
        email = f"{first.lower()}.{last.lower()}{sid}@student.college.edu.in"
        while email in used_student_emails:
            email = email.replace("@", f".{sid}@")
        used_student_emails.add(email)
        dob = date(admission_year - 18, 1 + (sid % 12), 1 + (sid % 27))
        status = STATUS_WEIGHTS[sid % len(STATUS_WEIGHTS)]
        if admission_year == 2021 and status == "Active":
            status = "Graduated"
        students.append((
            sid, f"ENR{admission_year}{dept:02d}{sid:03d}", first, last, email,
            f"9{rng.randint(100000000, 899999999)}",
            dob, GENDER_VALUES[sid % len(GENDER_VALUES)],
            admission_year, dept, status,
        ))
    parts.append(insert_block(
        "student",
        ["student_id", "enrollment_number", "first_name", "last_name", "email", "phone",
         "date_of_birth", "gender", "admission_year", "department_id", "status"],
        students,
    ))

    # Courses: four per department.
    courses = []
    cid = 0
    for dept_index, (code, _, _) in enumerate(DEPARTMENTS, start=1):
        for course_code, course_name, credits, description in COURSE_CATALOG[code]:
            cid += 1
            courses.append((cid, course_code, course_name, credits, dept_index, description))
    parts.append(insert_block(
        "course",
        ["course_id", "course_code", "course_name", "credits", "department_id", "description"],
        courses,
    ))

    parts.append(insert_block(
        "semester",
        ["semester_id", "semester_name", "academic_year", "start_date", "end_date", "status"],
        [(i, name, year, start, end, status)
         for i, (name, year, start, end, status) in enumerate(SEMESTERS, start=1)],
    ))

    # Offerings: 30 rows across four semesters (12 in a completed term, 8 in the
    # other completed term, 10 in the active term), all inside the owning department.
    # ids:  course_id = (department_id - 1) * 4 + slot + 1
    def course_id(dept: int, slot: int) -> int:
        return (dept - 1) * 4 + slot + 1

    offering_plan = [
        # (semester_id, department_id, number_of_courses, section, capacity)
        (1, 1, 4, "A", 45),   # CSE, completed semester
        (1, 2, 4, "A", 45),   # ECE, completed semester
        (1, 5, 4, "A", 40),   # CIV, completed semester
        (2, 3, 4, "A", 45),   # ME,  completed semester
        (2, 4, 4, "A", 45),   # EE,  completed semester
        (3, 1, 4, "B", 50),   # CSE, active semester
        (3, 2, 4, "B", 50),   # ECE, active semester
        (3, 3, 2, "B", 40),   # ME,  active semester
    ]
    offerings = []
    oid = 0
    for semester_id, dept_id, count, section, capacity in offering_plan:
        for slot in range(count):
            oid += 1
            offerings.append((oid, course_id(dept_id, slot), semester_id, section, capacity))
    parts.append(insert_block(
        "course_offering",
        ["offering_id", "course_id", "semester_id", "section", "capacity"],
        offerings,
    ))

    # Faculty assignments: 20 unique (faculty, offering) pairs, faculty teaching
    # inside their own department wherever possible.
    faculty_by_dept: dict[int, list[int]] = {}
    for row in faculty:
        faculty_by_dept.setdefault(row[8], []).append(row[0])
    assignments = []
    used_pairs = set()
    aid = 0
    for offering in offerings:
        if aid >= 20:
            break
        course_dept = next(c[4] for c in courses if c[0] == offering[1])
        for candidate in faculty_by_dept[course_dept]:
            pair = (candidate, offering[0])
            if pair in used_pairs:
                continue
            aid += 1
            used_pairs.add(pair)
            assignments.append((aid, candidate, offering[0]))
            break
    parts.append(insert_block(
        "faculty_assignment",
        ["assignment_id", "faculty_id", "offering_id"],
        assignments,
    ))

    # Enrollments: 100 unique (student, offering) pairs. Students are enrolled in
    # offerings owned by their own department: first a completed course (which can
    # carry a grade), then an active/upcoming course.
    semester_of_offering = {row[0]: row[2] for row in offerings}
    dept_of_offering = {row[0]: (row[1] - 1) // 4 + 1 for row in offerings}
    completed_pool: dict[int, list[int]] = {}
    active_pool: dict[int, list[int]] = {}
    for offering_id, semester_id in semester_of_offering.items():
        dept = dept_of_offering[offering_id]
        target = completed_pool if SEMESTERS[semester_id - 1][4] == "Completed" else active_pool
        target.setdefault(dept, []).append(offering_id)

    def enrollment_date_for(semester_id: int) -> date:
        return {
            1: date(2023, 7, 26),
            2: date(2024, 1, 10),
            3: date(2024, 7, 25),
            4: date(2025, 1, 8),
        }[semester_id]

    enrollments = []
    scored = []
    enrollment_id = 0
    for sid in range(1, 51):
        dept = (sid - 1) // 10 + 1
        done = completed_pool[dept]
        active = active_pool.get(dept, [])
        picks = [(done[sid % len(done)], "Completed")]
        if active:
            picks.append((active[sid % len(active)], "Enrolled"))
        else:
            picks.append((done[(sid + 1) % len(done)], "Completed"))
        for offering_id, status in picks:
            enrollment_id += 1
            semester_id = semester_of_offering[offering_id]
            enrollments.append((
                enrollment_id, sid, offering_id,
                enrollment_date_for(semester_id), status,
            ))
            scored.append((enrollment_id, status))

    # A few students withdrew from their second (active) course.
    enrollments = [
        (eid, sid, oid, edate, "Dropped" if eid % 19 == 0 else status)
        for eid, sid, oid, edate, status in enrollments
    ]
    scored = [(eid, next(status for row in enrollments if row[0] == eid for status in [row[4]]))
              for eid, _ in scored]

    # 60 grades for the completed enrollments (the rest stay ungraded / dropped).
    grades = []
    gid = 0
    for enrollment_id, status in scored:
        if gid >= 60:
            break
        if status != "Completed":
            continue
        gid += 1
        max_marks = 100
        marks = 41 + (gid * 13) % 56  # deterministic spread 41..96
        grades.append((gid, enrollment_id, marks, max_marks, grade_for(marks)))
    parts.append(insert_block(
        "enrollment",
        ["enrollment_id", "student_id", "offering_id", "enrollment_date", "enrollment_status"],
        enrollments,
    ))

    # 60 grades for completed enrollments only — an active/upcoming course is not
    # graded yet, and a dropped enrollment carries no grade.
    grades = []
    gid = 0
    for enrollment_id, status in scored:
        if gid >= 60:
            break
        if status != "Completed":
            continue
        gid += 1
        max_marks = 100
        marks = 41 + (gid * 13) % 56  # deterministic spread 41..96
        grades.append((gid, enrollment_id, marks, max_marks, grade_for(marks)))
    parts.append(insert_block(
        "grade",
        ["grade_id", "enrollment_id", "marks_obtained", "max_marks", "grade_letter"],
        grades,
    ))

    # Keep SERIAL sequences ahead of the explicit ids.
    for table, key in [
        ("department", "department_id"), ("student", "student_id"), ("faculty", "faculty_id"),
        ("course", "course_id"), ("semester", "semester_id"), ("course_offering", "offering_id"),
        ("faculty_assignment", "assignment_id"), ("enrollment", "enrollment_id"), ("grade", "grade_id"),
    ]:
        parts.append(
            f"SELECT setval(pg_get_serial_sequence('{table}', '{key}'), "
            f"COALESCE((SELECT MAX({key}) FROM {table}), 1));\n"
        )

    parts.append("\nCOMMIT;\n")
    return "".join(parts)


if __name__ == "__main__":
    sql = build()
    OUT.write_text(sql)
    counts = {
        "departments": sql.count("INSERT INTO department"),
    }
    print(f"wrote {OUT} ({len(sql)} bytes)")
