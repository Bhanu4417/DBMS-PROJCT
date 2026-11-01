"""SQLAlchemy ORM models mirroring database/schema.sql exactly."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Department(Base):
    __tablename__ = "department"
    __table_args__ = (
        UniqueConstraint("department_code", name="uq_department_code"),
        UniqueConstraint("department_name", name="uq_department_name"),
        CheckConstraint("department_code ~ '^[A-Z]{2,10}$'", name="ck_department_code_format"),
    )

    department_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    department_code: Mapped[str] = mapped_column(String(10), nullable=False)
    department_name: Mapped[str] = mapped_column(String(100), nullable=False)
    office_location: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    students: Mapped[list[Student]] = relationship(back_populates="department")
    faculty: Mapped[list[Faculty]] = relationship(back_populates="department")
    courses: Mapped[list[Course]] = relationship(back_populates="department")


class Student(Base):
    __tablename__ = "student"
    __table_args__ = (
        UniqueConstraint("enrollment_number", name="uq_student_enrollment_number"),
        UniqueConstraint("email", name="uq_student_email"),
        CheckConstraint("admission_year BETWEEN 2000 AND 2100", name="ck_student_admission_year"),
        CheckConstraint("status IN ('Active','Graduated','Inactive')", name="ck_student_status"),
        CheckConstraint(
            "gender IS NULL OR gender IN ('Female','Male','Non-binary','Prefer not to say')",
            name="ck_student_gender",
        ),
    )

    student_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enrollment_number: Mapped[str] = mapped_column(String(30), nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(15))
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    admission_year: Mapped[int] = mapped_column(Integer, nullable=False)
    department_id: Mapped[int | None] = mapped_column(
        ForeignKey("department.department_id", ondelete="RESTRICT", onupdate="CASCADE")
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Active")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    department: Mapped[Department | None] = relationship(back_populates="students")
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="student")


class Faculty(Base):
    __tablename__ = "faculty"
    __table_args__ = (
        UniqueConstraint("employee_code", name="uq_faculty_employee_code"),
        UniqueConstraint("email", name="uq_faculty_email"),
    )

    faculty_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(30), nullable=False)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(15))
    designation: Mapped[str | None] = mapped_column(String(100))
    joining_date: Mapped[date | None] = mapped_column(Date)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("department.department_id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    department: Mapped[Department] = relationship(back_populates="faculty")
    assignments: Mapped[list[FacultyAssignment]] = relationship(back_populates="faculty")


class Course(Base):
    __tablename__ = "course"
    __table_args__ = (
        UniqueConstraint("course_code", name="uq_course_code"),
        CheckConstraint("credits BETWEEN 1 AND 6", name="ck_course_credits"),
    )

    course_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_code: Mapped[str] = mapped_column(String(20), nullable=False)
    course_name: Mapped[str] = mapped_column(String(150), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    department_id: Mapped[int] = mapped_column(
        ForeignKey("department.department_id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text)

    department: Mapped[Department] = relationship(back_populates="courses")
    offerings: Mapped[list[CourseOffering]] = relationship(back_populates="course")


class Semester(Base):
    __tablename__ = "semester"
    __table_args__ = (
        UniqueConstraint("semester_name", "academic_year", name="uq_semester_term"),
        CheckConstraint("status IN ('Upcoming','Active','Completed')", name="ck_semester_status"),
        CheckConstraint("end_date > start_date", name="ck_semester_dates"),
    )

    semester_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    semester_name: Mapped[str] = mapped_column(String(50), nullable=False)
    academic_year: Mapped[str] = mapped_column(String(9), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Upcoming")

    offerings: Mapped[list[CourseOffering]] = relationship(back_populates="semester")


class CourseOffering(Base):
    __tablename__ = "course_offering"
    __table_args__ = (
        UniqueConstraint("course_id", "semester_id", "section", name="uq_offering_course_semester_section"),
        CheckConstraint("capacity > 0", name="ck_offering_capacity"),
    )

    offering_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("course.course_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    semester_id: Mapped[int] = mapped_column(
        ForeignKey("semester.semester_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    section: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    course: Mapped[Course] = relationship(back_populates="offerings")
    semester: Mapped[Semester] = relationship(back_populates="offerings")
    assignments: Mapped[list[FacultyAssignment]] = relationship(back_populates="offering")
    enrollments: Mapped[list[Enrollment]] = relationship(back_populates="offering")


class FacultyAssignment(Base):
    __tablename__ = "faculty_assignment"
    __table_args__ = (
        UniqueConstraint("faculty_id", "offering_id", name="uq_assignment_faculty_offering"),
    )

    assignment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    faculty_id: Mapped[int] = mapped_column(
        ForeignKey("faculty.faculty_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    offering_id: Mapped[int] = mapped_column(
        ForeignKey("course_offering.offering_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    faculty: Mapped[Faculty] = relationship(back_populates="assignments")
    offering: Mapped[CourseOffering] = relationship(back_populates="assignments")


class Enrollment(Base):
    __tablename__ = "enrollment"
    __table_args__ = (
        UniqueConstraint("student_id", "offering_id", name="uq_enrollment_student_offering"),
        CheckConstraint(
            "enrollment_status IN ('Enrolled','Completed','Dropped')", name="ck_enrollment_status"
        ),
    )

    enrollment_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        ForeignKey("student.student_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    offering_id: Mapped[int] = mapped_column(
        ForeignKey("course_offering.offering_id", ondelete="RESTRICT", onupdate="CASCADE"), nullable=False
    )
    enrollment_date: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    enrollment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="Enrolled")

    student: Mapped[Student] = relationship(back_populates="enrollments")
    offering: Mapped[CourseOffering] = relationship(back_populates="enrollments")
    grade: Mapped[Grade | None] = relationship(back_populates="enrollment", uselist=False)


class Grade(Base):
    __tablename__ = "grade"
    __table_args__ = (
        UniqueConstraint("enrollment_id", name="uq_grade_enrollment"),
        CheckConstraint("marks_obtained IS NULL OR marks_obtained >= 0", name="ck_grade_marks_non_negative"),
        CheckConstraint("max_marks > 0", name="ck_grade_max_positive"),
        CheckConstraint("marks_obtained IS NULL OR marks_obtained <= max_marks", name="ck_grade_marks_within_max"),
        CheckConstraint(
            "grade_letter IS NULL OR grade_letter IN ('A+','A','B+','B','C','D','F')",
            name="ck_grade_letter",
        ),
    )

    grade_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollment.enrollment_id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        unique=True,
    )
    marks_obtained: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    max_marks: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    grade_letter: Mapped[str | None] = mapped_column(String(2))
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    enrollment: Mapped[Enrollment] = relationship(back_populates="grade")
