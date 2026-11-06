/**
 * Declarative configuration for every management screen.
 * The generic <ResourcePage /> renders tables, filters, forms and actions from it.
 */
const GRADE_LETTERS = ['A+', 'A', 'B+', 'B', 'C', 'D', 'F'].map((value) => ({
  value,
  label: value,
}));

const STUDENT_STATUSES = ['Active', 'Graduated', 'Inactive'].map((value) => ({
  value,
  label: value,
}));

const SEMESTER_STATUSES = ['Upcoming', 'Active', 'Completed'].map((value) => ({
  value,
  label: value,
}));

const ENROLLMENT_STATUSES = ['Enrolled', 'Completed', 'Dropped'].map((value) => ({
  value,
  label: value,
}));

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'].map((value) => ({
  value,
  label: value,
}));

export const resources = {
  students: {
    key: 'students',
    endpoint: '/students',
    title: 'Students',
    description: 'Every enrolled student with their department, year and status.',
    searchPlaceholder: 'Search name, enrollment number or email',
    defaultSort: { by: 'name', dir: 'asc' },
    detailPath: (row) => `/students/${row.student_id}`,
    deleteWarning: 'Students with enrollment history cannot be deleted. Mark them Inactive instead.',
    emptyMessage: 'No students match this view. Add a student to get started.',
    filters: [
      { name: 'department_id', label: 'Department', source: 'departments', allLabel: 'All departments' },
      { name: 'status', label: 'Status', options: STUDENT_STATUSES, allLabel: 'All statuses' },
      { name: 'admission_year', label: 'Admission year', type: 'number', allLabel: 'All years' },
    ],
    sortOptions: [
      { value: 'name', label: 'Name' },
      { value: 'admission_year', label: 'Admission year' },
      { value: 'enrollment_number', label: 'Enrollment number' },
    ],
    columns: [
      { key: 'student_id', label: 'Student ID', type: 'count' },
      { key: 'enrollment_number', label: 'Enrollment no.', sortable: 'enrollment_number' },
      { key: 'full_name', label: 'Student', type: 'primary', sub: 'email' },
      { key: 'department_name', label: 'Department' },
      { key: 'admission_year', label: 'Admission year', sortable: 'admission_year' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    fields: [
      { name: 'enrollment_number', label: 'Enrollment number', required: true, half: true, placeholder: 'ENR2025001' },
      { name: 'admission_year', label: 'Admission year', type: 'number', required: true, half: true, min: 2000, max: 2100, defaultValue: 2025 },
      { name: 'first_name', label: 'First name', required: true, half: true },
      { name: 'last_name', label: 'Last name', required: true, half: true },
      { name: 'email', label: 'Email', type: 'email', required: true, half: true, placeholder: 'student@college.edu.in' },
      { name: 'phone', label: 'Phone', half: true, placeholder: '9876543210' },
      { name: 'date_of_birth', label: 'Date of birth', type: 'date', half: true },
      {
        name: 'gender',
        label: 'Gender',
        type: 'select',
        options: GENDERS,
        half: true,
        placeholder: 'Not specified',
      },
      { name: 'department_id', label: 'Department', type: 'select', source: 'departments', half: true, placeholder: 'Select a department' },
      { name: 'status', label: 'Status', type: 'select', options: STUDENT_STATUSES, defaultValue: 'Active', half: true },
    ],
    editValues: (row) => ({
      enrollment_number: row.enrollment_number,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone || '',
      date_of_birth: row.date_of_birth ? String(row.date_of_birth).slice(0, 10) : '',
      gender: row.gender || '',
      admission_year: row.admission_year,
      department_id: row.department_id ?? '',
      status: row.status,
    }),
  },

  faculty: {
    key: 'faculty',
    endpoint: '/faculty',
    title: 'Faculty',
    description: 'Teaching staff, their departments and course assignments.',
    searchPlaceholder: 'Search name, employee code or email',
    defaultSort: { by: 'name', dir: 'asc' },
    detailPath: (row) => `/faculty/${row.faculty_id}`,
    deleteWarning: 'Faculty with course assignments cannot be deleted. Remove the assignments first.',
    emptyMessage: 'No faculty members match this view.',
    filters: [{ name: 'department_id', label: 'Department', source: 'departments', allLabel: 'All departments' }],
    sortOptions: [
      { value: 'name', label: 'Name' },
      { value: 'designation', label: 'Designation' },
      { value: 'employee_code', label: 'Employee code' },
    ],
    columns: [
      { key: 'faculty_id', label: 'Faculty ID', type: 'count' },
      { key: 'employee_code', label: 'Employee code', sortable: 'employee_code' },
      { key: 'full_name', label: 'Faculty member', type: 'primary', sub: 'email' },
      { key: 'designation', label: 'Designation' },
      { key: 'department_name', label: 'Department' },
      { key: 'assignment_count', label: 'Assignments', type: 'count' },
    ],
    fields: [
      { name: 'employee_code', label: 'Employee code', required: true, half: true, placeholder: 'FAC-1001' },
      { name: 'designation', label: 'Designation', half: true, placeholder: 'Assistant Professor' },
      { name: 'first_name', label: 'First name', required: true, half: true },
      { name: 'last_name', label: 'Last name', required: true, half: true },
      { name: 'email', label: 'Email', type: 'email', required: true, half: true },
      { name: 'phone', label: 'Phone', half: true },
      { name: 'joining_date', label: 'Joining date', type: 'date', half: true },
      { name: 'department_id', label: 'Department', type: 'select', source: 'departments', required: true, half: true },
    ],
    editValues: (row) => ({
      employee_code: row.employee_code,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone || '',
      designation: row.designation || '',
      joining_date: row.joining_date ? String(row.joining_date).slice(0, 10) : '',
      department_id: row.department_id,
    }),
  },

  departments: {
    key: 'departments',
    endpoint: '/departments',
    title: 'Departments',
    description: 'Academic departments with live student, faculty and course counts.',
    searchPlaceholder: 'Search department name or code',
    defaultSort: { by: 'code', dir: 'asc' },
    deleteWarning: 'A department cannot be deleted while students, faculty or courses still reference it.',
    emptyMessage: 'No departments yet. Create the first academic department.',
    filters: [],
    sortOptions: [
      { value: 'code', label: 'Code' },
      { value: 'name', label: 'Name' },
    ],
    columns: [
      { key: 'department_id', label: 'Department ID', type: 'count' },
      { key: 'department_code', label: 'Code', sortable: 'code', type: 'code' },
      { key: 'department_name', label: 'Department', type: 'primary', sub: 'office_location' },
      { key: 'student_count', label: 'Students', type: 'count', sortable: null },
      { key: 'faculty_count', label: 'Faculty', type: 'count' },
      { key: 'course_count', label: 'Courses', type: 'count' },
    ],
    fields: [
      { name: 'department_code', label: 'Department code', required: true, half: true, placeholder: 'CSE', help: '2–10 uppercase letters' },
      { name: 'office_location', label: 'Office location', half: true, placeholder: 'Block A, Room 101' },
      { name: 'department_name', label: 'Department name', required: true, placeholder: 'Computer Science and Engineering' },
    ],
    editValues: (row) => ({
      department_code: row.department_code,
      department_name: row.department_name,
      office_location: row.office_location || '',
    }),
  },

  courses: {
    key: 'courses',
    endpoint: '/courses',
    title: 'Courses',
    description: 'Course catalogue with credits and owning department.',
    searchPlaceholder: 'Search course code or name',
    defaultSort: { by: 'code', dir: 'asc' },
    detailPath: (row) => `/courses/${row.course_id}`,
    deleteWarning: 'Courses that are offered in a semester cannot be deleted.',
    emptyMessage: 'No courses in the catalogue yet.',
    filters: [{ name: 'department_id', label: 'Department', source: 'departments', allLabel: 'All departments' }],
    sortOptions: [
      { value: 'code', label: 'Course code' },
      { value: 'name', label: 'Course name' },
      { value: 'credits', label: 'Credits' },
    ],
    columns: [
      { key: 'offering_id', label: 'Offering ID', type: 'count' },
      { key: 'course_id', label: 'Course ID', type: 'count' },
      { key: 'course_code', label: 'Course code', sortable: 'code', type: 'code' },
      { key: 'course_name', label: 'Course', type: 'primary', sub: 'description' },
      { key: 'credits', label: 'Credits', type: 'count', sortable: 'credits' },
      { key: 'department_name', label: 'Department' },
      { key: 'offering_count', label: 'Offerings', type: 'count' },
    ],
    fields: [
      { name: 'course_code', label: 'Course code', required: true, half: true, placeholder: 'CSE-301', help: 'Format: CSE-301' },
      { name: 'credits', label: 'Credits', type: 'number', required: true, half: true, min: 1, max: 6, defaultValue: 4 },
      { name: 'course_name', label: 'Course name', required: true, placeholder: 'Database Management Systems' },
      { name: 'department_id', label: 'Department', type: 'select', source: 'departments', required: true },
      { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Short syllabus summary' },
    ],
    editValues: (row) => ({
      course_code: row.course_code,
      course_name: row.course_name,
      credits: row.credits,
      department_id: row.department_id,
      description: row.description || '',
    }),
  },

  semesters: {
    key: 'semesters',
    endpoint: '/semesters',
    title: 'Semesters',
    description: 'Academic terms, their date ranges and status.',
    searchPlaceholder: 'Search semester or academic year',
    defaultSort: { by: 'start', dir: 'desc' },
    detailPath: (row) => `/semesters/${row.semester_id}`,
    deleteWarning: 'Semesters that contain course offerings cannot be deleted.',
    emptyMessage: 'No semesters defined yet.',
    filters: [{ name: 'status', label: 'Status', options: SEMESTER_STATUSES, allLabel: 'All statuses' }],
    sortOptions: [
      { value: 'start', label: 'Start date' },
      { value: 'name', label: 'Semester name' },
      { value: 'status', label: 'Status' },
    ],
    columns: [
      { key: 'semester_id', label: 'Semester ID', type: 'count' },
      { key: 'semester_name', label: 'Semester', type: 'primary', sub: 'academic_year' },
      { key: 'start_date', label: 'Starts', type: 'date' },
      { key: 'end_date', label: 'Ends', type: 'date' },
      { key: 'offering_count', label: 'Offerings', type: 'count' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
    fields: [
      { name: 'semester_name', label: 'Semester name', required: true, half: true, placeholder: 'Odd Semester' },
      { name: 'academic_year', label: 'Academic year', required: true, half: true, placeholder: '2025-2026', help: 'Format: 2025-2026' },
      { name: 'start_date', label: 'Start date', type: 'date', required: true, half: true },
      { name: 'end_date', label: 'End date', type: 'date', required: true, half: true },
      { name: 'status', label: 'Status', type: 'select', options: SEMESTER_STATUSES, defaultValue: 'Upcoming', half: true },
    ],
    editValues: (row) => ({
      semester_name: row.semester_name,
      academic_year: row.academic_year,
      start_date: String(row.start_date).slice(0, 10),
      end_date: String(row.end_date).slice(0, 10),
      status: row.status,
    }),
  },

  offerings: {
    key: 'offerings',
    endpoint: '/offerings',
    title: 'Course offerings',
    description: 'Each course taught in a semester, with capacity and enrolled count.',
    searchPlaceholder: 'Search course code or name',
    defaultSort: { by: 'course', dir: 'asc' },
    detailPath: (row) => `/offerings/${row.offering_id}`,
    deleteWarning: 'Offerings with enrollments or faculty assignments cannot be deleted.',
    emptyMessage: 'No course offerings created yet.',
    filters: [
      { name: 'semester_id', label: 'Semester', source: 'semesters', allLabel: 'All semesters' },
      { name: 'course_id', label: 'Course', source: 'courses', allLabel: 'All courses' },
    ],
    sortOptions: [
      { value: 'course', label: 'Course code' },
      { value: 'semester', label: 'Semester' },
      { value: 'capacity', label: 'Capacity' },
    ],
    columns: [
      { key: 'course_id', label: 'Course ID', type: 'count' },
      { key: 'course_code', label: 'Course code', type: 'primary', sub: 'course_name' },
      { key: 'semester_name', label: 'Semester', sub: 'academic_year' },
      { key: 'section', label: 'Section', type: 'code' },
      { key: 'capacity', label: 'Capacity', type: 'count' },
      { key: 'enrolled', label: 'Enrolled', type: 'seats' },
      { key: 'faculty_names', label: 'Faculty' },
    ],
    fields: [
      { name: 'course_id', label: 'Course', type: 'select', source: 'courses', required: true },
      { name: 'semester_id', label: 'Semester', type: 'select', source: 'semesters', required: true, half: true },
      { name: 'section', label: 'Section', required: true, half: true, defaultValue: 'A', placeholder: 'A' },
      { name: 'capacity', label: 'Capacity', type: 'number', required: true, min: 1, max: 500, defaultValue: 60 },
    ],
    editValues: (row) => ({
      course_id: row.course_id,
      semester_id: row.semester_id,
      section: row.section,
      capacity: row.capacity,
    }),
  },

  assignments: {
    key: 'assignments',
    endpoint: '/assignments',
    title: 'Faculty assignments',
    description: 'Which faculty member teaches which course offering.',
    searchPlaceholder: 'Search faculty or course',
    defaultSort: { by: 'faculty', dir: 'asc' },
    deleteWarning: 'Removing an assignment only unlinks the faculty member from the offering.',
    emptyMessage: 'No faculty assignments yet.',
    filters: [
      { name: 'semester_id', label: 'Semester', source: 'semesters', allLabel: 'All semesters' },
      { name: 'department_id', label: 'Department', source: 'departments', allLabel: 'All departments' },
    ],
    sortOptions: [
      { value: 'faculty', label: 'Faculty name' },
      { value: 'course', label: 'Course code' },
    ],
    columns: [
      { key: 'assignment_id', label: 'Assignment ID', type: 'count' },
      { key: 'faculty_name', label: 'Faculty', type: 'primary', sub: 'employee_code' },
      { key: 'course_code', label: 'Course', type: 'primary', sub: 'course_name' },
      { key: 'semester_name', label: 'Semester', sub: 'academic_year' },
      { key: 'section', label: 'Section', type: 'code' },
      { key: 'department_name', label: 'Department' },
    ],
    fields: [
      { name: 'faculty_id', label: 'Faculty member', type: 'select', source: 'faculty', required: true },
      { name: 'offering_id', label: 'Course offering', type: 'select', source: 'offerings', required: true },
    ],
    editValues: (row) => ({ faculty_id: row.faculty_id, offering_id: row.offering_id }),
  },

  enrollments: {
    key: 'enrollments',
    endpoint: '/enrollments',
    title: 'Enrollments',
    description: 'Student registrations per offering, with capacity-safe enrolment.',
    searchPlaceholder: 'Search student or course',
    defaultSort: { by: 'date', dir: 'desc' },
    deleteWarning:
      'Enrollments with a grade cannot be deleted. Set the status to Dropped instead of erasing history.',
    emptyMessage: 'No enrollments recorded yet.',
    filters: [
      { name: 'student_id', label: 'Student', source: 'students', allLabel: 'All students' },
      { name: 'semester_id', label: 'Semester', source: 'semesters', allLabel: 'All semesters' },
      { name: 'course_id', label: 'Course', source: 'courses', allLabel: 'All courses' },
      { name: 'enrollment_status', label: 'Status', options: ENROLLMENT_STATUSES, allLabel: 'All statuses' },
    ],
    sortOptions: [
      { value: 'date', label: 'Enrollment date' },
      { value: 'student', label: 'Student name' },
      { value: 'course', label: 'Course code' },
    ],
    columns: [
      { key: 'enrollment_id', label: 'Enrollment ID', type: 'count' },
      { key: 'student_name', label: 'Student', type: 'primary', sub: 'enrollment_number' },
      { key: 'course_code', label: 'Course', type: 'primary', sub: 'course_name' },
      { key: 'semester_name', label: 'Semester', sub: 'academic_year' },
      { key: 'section', label: 'Section', type: 'code' },
      { key: 'enrollment_date', label: 'Enrolled on', type: 'date' },
      { key: 'enrollment_status', label: 'Status', type: 'badge' },
      { key: 'grade_letter', label: 'Grade', type: 'grade' },
    ],
    fields: [
      { name: 'student_id', label: 'Student', type: 'select', source: 'students', required: true },
      { name: 'offering_id', label: 'Course offering', type: 'select', source: 'offerings', required: true },
      { name: 'enrollment_status', label: 'Status', type: 'select', options: ENROLLMENT_STATUSES, defaultValue: 'Enrolled', half: true },
      { name: 'enrollment_date', label: 'Enrollment date', type: 'date', half: true },
    ],
    editFields: [
      { name: 'enrollment_status', label: 'Status', type: 'select', options: ENROLLMENT_STATUSES, required: true, half: true },
      { name: 'enrollment_date', label: 'Enrollment date', type: 'date', half: true },
    ],
    editValues: (row) => ({
      enrollment_status: row.enrollment_status,
      enrollment_date: String(row.enrollment_date).slice(0, 10),
    }),
  },

  grades: {
    key: 'grades',
    endpoint: '/grades',
    title: 'Grades',
    description: 'Marks and letter grades — one record per enrollment.',
    searchPlaceholder: 'Search student or course',
    defaultSort: { by: 'student', dir: 'asc' },
    deleteWarning: 'Deleting a grade removes the marks from the academic record.',
    emptyMessage: 'No grades recorded yet.',
    filters: [
      { name: 'semester_id', label: 'Semester', source: 'semesters', allLabel: 'All semesters' },
      { name: 'course_id', label: 'Course', source: 'courses', allLabel: 'All courses' },
      { name: 'grade_letter', label: 'Grade', options: GRADE_LETTERS, allLabel: 'All grades' },
    ],
    sortOptions: [
      { value: 'student', label: 'Student name' },
      { value: 'course', label: 'Course code' },
      { value: 'marks', label: 'Marks' },
    ],
    columns: [
      { key: 'grade_id', label: 'Grade ID', type: 'count' },
      { key: 'student_name', label: 'Student', type: 'primary', sub: 'enrollment_number' },
      { key: 'course_code', label: 'Course', type: 'primary', sub: 'course_name' },
      { key: 'semester_name', label: 'Semester', sub: 'academic_year' },
      { key: 'marks_obtained', label: 'Marks', type: 'marks' },
      { key: 'grade_letter', label: 'Grade', type: 'badge' },
    ],
    fields: [
      { name: 'enrollment_id', label: 'Enrollment (ungraded only)', type: 'select', source: 'ungradedEnrollments', required: true },
      { name: 'marks_obtained', label: 'Marks obtained', type: 'number', step: '0.01', min: 0, half: true },
      { name: 'max_marks', label: 'Maximum marks', type: 'number', step: '0.01', min: 1, defaultValue: 100, required: true, half: true },
      { name: 'grade_letter', label: 'Grade letter', type: 'select', options: GRADE_LETTERS, half: true, placeholder: 'Not assigned' },
    ],
    editFields: [
      { name: 'marks_obtained', label: 'Marks obtained', type: 'number', step: '0.01', min: 0, half: true },
      { name: 'max_marks', label: 'Maximum marks', type: 'number', step: '0.01', min: 1, required: true, half: true },
      { name: 'grade_letter', label: 'Grade letter', type: 'select', options: GRADE_LETTERS, half: true, placeholder: 'Not assigned' },
    ],
    editValues: (row) => ({
      marks_obtained: row.marks_obtained ?? '',
      max_marks: row.max_marks,
      grade_letter: row.grade_letter || '',
    }),
  },
};

const simple=(key,title,pk,fields,columns)=>({key,endpoint:`/${key}`,title,description:'Administrator-managed records. Students have read-only access to their own records.',searchPlaceholder:'Records',defaultSort:{by:pk,dir:'desc'},filters:[],sortOptions:[],fields,columns:[{key:pk,label:'ID',type:'count'},...columns],deleteWarning:'This action removes the selected record. Related academic history is protected.',editValues:row=>Object.fromEntries(fields.map(f=>[f.name,row[f.name]??'']))});
resources.attendance=simple('attendance','Attendance','attendance_id',[
{name:'enrollment_id',label:'Enrollment',type:'select',source:'enrollments',required:true},
{name:'date',label:'Date',type:'date',required:true},
{name:'status',label:'Status',type:'select',required:true,defaultValue:'Present',options:['Present','Absent','Late','Excused'].map(value=>({value,label:value}))}
],[{key:'enrollment_id',label:'Enrollment ID'},{key:'date',label:'Date',type:'date'},{key:'status',label:'Status',type:'badge'}]);
export default resources;
