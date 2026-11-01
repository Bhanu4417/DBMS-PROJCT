// All academic facts are joined from the nine normalized tables.
const count = (table, condition) => `(SELECT count(*) FROM ${table} WHERE ${condition})`;
const enrolled = count('enrollment e', "e.offering_id=o.offering_id AND e.enrollment_status<>'Dropped'");
export const queries = {
  departments: `SELECT d.*, ${count('student', 'department_id=d.department_id')} student_count, ${count('faculty', 'department_id=d.department_id')} faculty_count, ${count('course', 'department_id=d.department_id')} course_count FROM department d`,
  students: `SELECT s.*, s.first_name||' '||s.last_name full_name, d.department_name, ${count('enrollment', 'student_id=s.student_id')} enrollment_count FROM student s LEFT JOIN department d USING(department_id)`,
  faculty: `SELECT f.*, f.first_name||' '||f.last_name full_name, d.department_name, ${count('faculty_assignment', 'faculty_id=f.faculty_id')} assignment_count FROM faculty f JOIN department d USING(department_id)`,
  courses: `SELECT c.*, d.department_name, ${count('course_offering', 'course_id=c.course_id')} offering_count FROM course c JOIN department d USING(department_id)`,
  semesters: `SELECT s.*, ${count('course_offering', 'semester_id=s.semester_id')} offering_count FROM semester s`,
  offerings: `SELECT o.*, c.course_code,c.course_name,c.credits,c.department_id, s.semester_name,s.academic_year,s.status semester_status,s.start_date, ${enrolled} enrolled, o.capacity-${enrolled} seats_available, (SELECT group_concat(f.first_name||' '||f.last_name, ', ') FROM faculty_assignment a JOIN faculty f USING(faculty_id) WHERE a.offering_id=o.offering_id) faculty_names FROM course_offering o JOIN course c USING(course_id) JOIN semester s USING(semester_id)`,
  assignments: `SELECT a.*, f.first_name||' '||f.last_name faculty_name,f.employee_code,f.designation,f.department_id,d.department_name,o.section,o.semester_id,c.course_code,c.course_name,s.semester_name,s.academic_year FROM faculty_assignment a JOIN faculty f USING(faculty_id) JOIN department d ON d.department_id=f.department_id JOIN course_offering o USING(offering_id) JOIN course c USING(course_id) JOIN semester s USING(semester_id)`,
  enrollments: `SELECT e.*,st.enrollment_number,st.first_name||' '||st.last_name student_name,st.department_id,d.department_name,o.section,c.course_id,c.course_code,c.course_name,c.credits,s.semester_id,s.semester_name,s.academic_year,g.grade_letter,g.marks_obtained,g.max_marks,g.grade_id FROM enrollment e JOIN student st USING(student_id) LEFT JOIN department d ON d.department_id=st.department_id JOIN course_offering o USING(offering_id) JOIN course c USING(course_id) JOIN semester s USING(semester_id) LEFT JOIN grade g USING(enrollment_id)`,
  grades: `SELECT g.*,e.student_id,e.offering_id,st.enrollment_number,st.first_name||' '||st.last_name student_name,c.course_id,c.course_code,c.course_name,c.credits,s.semester_id,s.semester_name,s.academic_year,round(g.marks_obtained*100.0/g.max_marks,2) percentage FROM grade g JOIN enrollment e USING(enrollment_id) JOIN student st USING(student_id) JOIN course_offering o USING(offering_id) JOIN course c USING(course_id) JOIN semester s USING(semester_id)`,
};
export const resources = {
  departments: ['department','department_id','department_code department_name office_location','department_code'],
  students: ['student','student_id','enrollment_number first_name last_name email phone date_of_birth gender admission_year department_id status','full_name'],
  faculty: ['faculty','faculty_id','employee_code first_name last_name email phone designation joining_date department_id','full_name'],
  courses: ['course','course_id','course_code course_name credits department_id description','course_code'],
  semesters: ['semester','semester_id','semester_name academic_year start_date end_date status','start_date'],
  offerings: ['course_offering','offering_id','course_id semester_id section capacity','course_code'],
  assignments: ['faculty_assignment','assignment_id','faculty_id offering_id','faculty_name'],
  enrollments: ['enrollment','enrollment_id','student_id offering_id enrollment_date enrollment_status','enrollment_date'],
  grades: ['grade','grade_id','enrollment_id marks_obtained max_marks grade_letter','student_name'],
};
export const capacityTriggers = `
CREATE TRIGGER IF NOT EXISTS capacity_insert BEFORE INSERT ON enrollment
WHEN NEW.enrollment_status <> 'Dropped' AND (SELECT count(*) FROM enrollment WHERE offering_id=NEW.offering_id AND enrollment_status<>'Dropped') >= (SELECT capacity FROM course_offering WHERE offering_id=NEW.offering_id)
BEGIN SELECT RAISE(ABORT, 'Offering is full: capacity reached'); END;
CREATE TRIGGER IF NOT EXISTS capacity_update BEFORE UPDATE ON enrollment
WHEN NEW.enrollment_status <> 'Dropped' AND (SELECT count(*) FROM enrollment WHERE offering_id=NEW.offering_id AND enrollment_status<>'Dropped' AND enrollment_id<>OLD.enrollment_id) >= (SELECT capacity FROM course_offering WHERE offering_id=NEW.offering_id)
BEGIN SELECT RAISE(ABORT, 'Offering is full: capacity reached'); END;
CREATE TRIGGER IF NOT EXISTS capacity_reduce BEFORE UPDATE OF capacity ON course_offering
WHEN NEW.capacity < (SELECT count(*) FROM enrollment WHERE offering_id=OLD.offering_id AND enrollment_status<>'Dropped')
BEGIN SELECT RAISE(ABORT, 'Capacity cannot be below current enrollment'); END;
CREATE TRIGGER IF NOT EXISTS grade_touch AFTER UPDATE ON grade BEGIN UPDATE grade SET updated_at=CURRENT_TIMESTAMP WHERE grade_id=NEW.grade_id; END;
`;
