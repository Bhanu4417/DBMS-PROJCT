"""Pydantic request/response schemas with field-level validation."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Gender = Literal["Female", "Male", "Non-binary", "Prefer not to say"]
StudentStatus = Literal["Active", "Graduated", "Inactive"]
SemesterStatus = Literal["Upcoming", "Active", "Completed"]
EnrollmentStatus = Literal["Enrolled", "Completed", "Dropped"]
GradeLetter = Literal["A+", "A", "B+", "B", "C", "D", "F"]

PHONE_PATTERN = r"^[0-9+ -]{7,15}$"


# --------------------------------------------------------------------------- #
# Department
# --------------------------------------------------------------------------- #
class DepartmentBase(BaseModel):
    department_code: str = Field(min_length=2, max_length=10, pattern=r"^[A-Z]{2,10}$")
    department_name: str = Field(min_length=3, max_length=100)
    office_location: str | None = Field(default=None, max_length=100)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    department_code: str | None = Field(default=None, min_length=2, max_length=10, pattern=r"^[A-Z]{2,10}$")
    department_name: str | None = Field(default=None, min_length=3, max_length=100)
    office_location: str | None = Field(default=None, max_length=100)


class DepartmentRead(DepartmentBase):
    model_config = ConfigDict(from_attributes=True)
    department_id: int
    created_at: datetime


class DepartmentListItem(DepartmentRead):
    student_count: int = 0
    faculty_count: int = 0
    course_count: int = 0


# --------------------------------------------------------------------------- #
# Student
# --------------------------------------------------------------------------- #
class StudentBase(BaseModel):
    enrollment_number: str = Field(min_length=3, max_length=30)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: EmailStr
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    date_of_birth: date | None = None
    gender: Gender | None = None
    admission_year: int = Field(ge=2000, le=2100)
    department_id: int | None = None
    status: StudentStatus = "Active"

    @field_validator("first_name", "last_name", "enrollment_number")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("date_of_birth")
    @classmethod
    def plausible_dob(cls, value: date | None) -> date | None:
        if value is None:
            return value
        if value >= date.today():
            raise ValueError("date of birth must be in the past")
        if value.year < 1930:
            raise ValueError("date of birth is not plausible")
        return value


class StudentCreate(StudentBase):
    pass


class StudentUpdate(BaseModel):
    enrollment_number: str | None = Field(default=None, min_length=3, max_length=30)
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    date_of_birth: date | None = None
    gender: Gender | None = None
    admission_year: int | None = Field(default=None, ge=2000, le=2100)
    department_id: int | None = None
    status: StudentStatus | None = None


class StudentRead(StudentBase):
    model_config = ConfigDict(from_attributes=True)
    student_id: int
    created_at: datetime


class StudentListItem(BaseModel):
    student_id: int
    enrollment_number: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: str | None
    admission_year: int
    department_id: int | None
    department_name: str | None
    status: str
    enrollment_count: int = 0
    created_at: datetime


class EnrollmentHistoryItem(BaseModel):
    enrollment_id: int
    course_code: str
    course_name: str
    credits: int
    semester_name: str
    academic_year: str
    section: str
    enrollment_date: date
    enrollment_status: str
    marks_obtained: Decimal | None
    max_marks: Decimal | None
    grade_letter: str | None


class StudentDetail(StudentListItem):
    date_of_birth: date | None
    gender: str | None
    enrollments: list[EnrollmentHistoryItem] = []


# --------------------------------------------------------------------------- #
# Faculty
# --------------------------------------------------------------------------- #
class FacultyBase(BaseModel):
    employee_code: str = Field(min_length=2, max_length=30)
    first_name: str = Field(min_length=1, max_length=50)
    last_name: str = Field(min_length=1, max_length=50)
    email: EmailStr
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    designation: str | None = Field(default=None, max_length=100)
    joining_date: date | None = None
    department_id: int


class FacultyCreate(FacultyBase):
    pass


class FacultyUpdate(BaseModel):
    employee_code: str | None = Field(default=None, min_length=2, max_length=30)
    first_name: str | None = Field(default=None, min_length=1, max_length=50)
    last_name: str | None = Field(default=None, min_length=1, max_length=50)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=PHONE_PATTERN)
    designation: str | None = Field(default=None, max_length=100)
    joining_date: date | None = None
    department_id: int | None = None


class FacultyRead(FacultyBase):
    model_config = ConfigDict(from_attributes=True)
    faculty_id: int
    created_at: datetime


class FacultyListItem(BaseModel):
    faculty_id: int
    employee_code: str
    first_name: str
    last_name: str
    full_name: str
    email: str
    phone: str | None
    designation: str | None
    joining_date: date | None
    department_id: int
    department_name: str
    assignment_count: int = 0
    created_at: datetime


class AssignmentSummary(BaseModel):
    assignment_id: int
    offering_id: int
    course_code: str
    course_name: str
    semester_name: str
    academic_year: str
    section: str
    assigned_at: datetime


class FacultyDetail(FacultyListItem):
    assignments: list[AssignmentSummary] = []


# --------------------------------------------------------------------------- #
# Course
# --------------------------------------------------------------------------- #
class CourseBase(BaseModel):
    course_code: str = Field(min_length=3, max_length=20, pattern=r"^[A-Z]{2,6}-?[0-9]{3,4}$")
    course_name: str = Field(min_length=3, max_length=150)
    credits: int = Field(ge=1, le=6)
    department_id: int
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("course_code")
    @classmethod
    def uppercase_code(cls, value: str) -> str:
        return value.strip().upper()


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    course_code: str | None = Field(default=None, min_length=3, max_length=20, pattern=r"^[A-Z]{2,6}-?[0-9]{3,4}$")
    course_name: str | None = Field(default=None, min_length=3, max_length=150)
    credits: int | None = Field(default=None, ge=1, le=6)
    department_id: int | None = None
    description: str | None = Field(default=None, max_length=2000)


class CourseRead(CourseBase):
    model_config = ConfigDict(from_attributes=True)
    course_id: int


class CourseListItem(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    credits: int
    department_id: int
    department_name: str
    description: str | None
    offering_count: int = 0


class OfferingSummary(BaseModel):
    offering_id: int
    course_code: str
    course_name: str
    semester_name: str
    academic_year: str
    section: str
    capacity: int
    enrolled: int
    semester_status: str


class CourseDetail(CourseListItem):
    offerings: list[OfferingSummary] = []


# --------------------------------------------------------------------------- #
# Semester
# --------------------------------------------------------------------------- #
class SemesterBase(BaseModel):
    semester_name: str = Field(min_length=2, max_length=50)
    academic_year: str = Field(pattern=r"^[0-9]{4}-[0-9]{4}$")
    start_date: date
    end_date: date
    status: SemesterStatus = "Upcoming"

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be later than start_date")
        return self


class SemesterCreate(SemesterBase):
    pass


class SemesterUpdate(BaseModel):
    semester_name: str | None = Field(default=None, min_length=2, max_length=50)
    academic_year: str | None = Field(default=None, pattern=r"^[0-9]{4}-[0-9]{4}$")
    start_date: date | None = None
    end_date: date | None = None
    status: SemesterStatus | None = None


class SemesterRead(SemesterBase):
    model_config = ConfigDict(from_attributes=True)
    semester_id: int


class SemesterListItem(BaseModel):
    semester_id: int
    semester_name: str
    academic_year: str
    start_date: date
    end_date: date
    status: str
    offering_count: int = 0


# --------------------------------------------------------------------------- #
# Course offering
# --------------------------------------------------------------------------- #
class OfferingBase(BaseModel):
    course_id: int
    semester_id: int
    section: str = Field(min_length=1, max_length=20)
    capacity: int = Field(gt=0, le=500)


class OfferingCreate(OfferingBase):
    pass


class OfferingUpdate(BaseModel):
    course_id: int | None = None
    semester_id: int | None = None
    section: str | None = Field(default=None, min_length=1, max_length=20)
    capacity: int | None = Field(default=None, gt=0, le=500)


class OfferingRead(OfferingBase):
    model_config = ConfigDict(from_attributes=True)
    offering_id: int
    created_at: datetime


class OfferingListItem(BaseModel):
    offering_id: int
    course_id: int
    course_code: str
    course_name: str
    credits: int
    semester_id: int
    semester_name: str
    academic_year: str
    semester_status: str
    section: str
    capacity: int
    enrolled: int
    seats_available: int
    faculty_names: str | None
    created_at: datetime


class OfferingStudent(BaseModel):
    enrollment_id: int
    student_id: int
    enrollment_number: str
    student_name: str
    enrollment_status: str
    grade_letter: str | None


class OfferingDetail(OfferingListItem):
    students: list[OfferingStudent] = []
    faculty: list[dict] = []


# --------------------------------------------------------------------------- #
# Faculty assignment
# --------------------------------------------------------------------------- #
class AssignmentCreate(BaseModel):
    faculty_id: int
    offering_id: int


class AssignmentUpdate(BaseModel):
    faculty_id: int | None = None
    offering_id: int | None = None


class AssignmentRead(BaseModel):
    assignment_id: int
    faculty_id: int
    faculty_name: str
    employee_code: str
    department_name: str
    offering_id: int
    course_code: str
    course_name: str
    semester_name: str
    academic_year: str
    section: str
    assigned_at: datetime


# --------------------------------------------------------------------------- #
# Enrollment
# --------------------------------------------------------------------------- #
class EnrollmentCreate(BaseModel):
    student_id: int
    offering_id: int
    enrollment_date: date | None = None
    enrollment_status: EnrollmentStatus = "Enrolled"


class EnrollmentUpdate(BaseModel):
    enrollment_date: date | None = None
    enrollment_status: EnrollmentStatus | None = None


class EnrollmentSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    enrollment_id: int
    student_id: int
    offering_id: int
    enrollment_date: date
    enrollment_status: str


class EnrollmentRead(BaseModel):
    enrollment_id: int
    student_id: int
    enrollment_number: str
    student_name: str
    department_name: str | None
    offering_id: int
    course_id: int
    course_code: str
    course_name: str
    semester_id: int
    semester_name: str
    academic_year: str
    section: str
    enrollment_date: date
    enrollment_status: str
    grade_letter: str | None


# --------------------------------------------------------------------------- #
# Grade
# --------------------------------------------------------------------------- #
class GradeBase(BaseModel):
    enrollment_id: int
    marks_obtained: Decimal | None = Field(default=None, ge=0, max_digits=5, decimal_places=2)
    max_marks: Decimal = Field(default=Decimal("100"), gt=0, max_digits=5, decimal_places=2)
    grade_letter: GradeLetter | None = None

    @model_validator(mode="after")
    def marks_within_max(self):
        if self.marks_obtained is not None and self.marks_obtained > self.max_marks:
            raise ValueError("marks_obtained cannot exceed max_marks")
        return self


class GradeCreate(GradeBase):
    pass


class GradeUpdate(BaseModel):
    marks_obtained: Decimal | None = Field(default=None, ge=0, max_digits=5, decimal_places=2)
    max_marks: Decimal | None = Field(default=None, gt=0, max_digits=5, decimal_places=2)
    grade_letter: GradeLetter | None = None


class GradeSimple(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    grade_id: int
    enrollment_id: int
    marks_obtained: Decimal | None
    max_marks: Decimal
    grade_letter: str | None
    updated_at: datetime


class GradeRead(BaseModel):
    grade_id: int
    enrollment_id: int
    student_id: int
    enrollment_number: str
    student_name: str
    course_code: str
    course_name: str
    semester_name: str
    academic_year: str
    credits: int
    marks_obtained: Decimal | None
    max_marks: Decimal
    grade_letter: str | None
    percentage: float | None
    updated_at: datetime
