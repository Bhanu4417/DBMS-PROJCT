export const reportDefinitions = {
  'students-by-department': ['Students by department', 'department_code department_name students'],
  'students-by-year': ['Students by admission year', 'admission_year students'],
  'students-by-status': ['Active vs inactive students', 'status students'],
  'faculty-by-department': ['Faculty by department', 'department_code department_name faculty'],
  'faculty-assignments': ['Faculty course assignments', 'employee_code faculty_name department_name course_code course_name semester_name academic_year section'],
  'course-enrollment': ['Course enrollment counts', 'course_code course_name offerings enrolled'],
  'capacity-utilization': ['Course capacity utilisation', 'course_code course_name semester_name academic_year section capacity enrolled utilisation_percent'],
  'grade-report': ['Student grade report', 'enrollment_number student_name course_code course_name semester_name academic_year marks_obtained max_marks grade_letter percentage'],
  'semester-summary': ['Semester enrollment summary', 'semester_name academic_year status offerings enrollments students'],
};
export function reporting(all, rows) {
  const report = (key) => {
    switch(key) {
      case 'students-by-department': return rows('departments').map(r=>({department_code:r.department_code,department_name:r.department_name,students:r.student_count}));
      case 'faculty-by-department': return rows('departments').map(r=>({department_code:r.department_code,department_name:r.department_name,faculty:r.faculty_count}));
      case 'students-by-year': return all('SELECT admission_year,count(*) students FROM student GROUP BY admission_year ORDER BY admission_year');
      case 'students-by-status': return all('SELECT status,count(*) students FROM student GROUP BY status ORDER BY status');
      case 'faculty-assignments': return rows('assignments');
      case 'grade-report': return rows('grades');
      case 'course-enrollment': return rows('courses').map(c=>({...c,offerings:c.offering_count,enrolled:rows('offerings').filter(o=>o.course_id===c.course_id).reduce((n,o)=>n+o.enrolled,0)})).sort((a,b)=>b.enrolled-a.enrolled);
      case 'capacity-utilization': return rows('offerings').map(o=>({...o,utilisation_percent:Math.round(o.enrolled*1000/o.capacity)/10}));
      case 'semester-summary': return rows('semesters').map(s=>{const es=rows('enrollments').filter(e=>e.semester_id===s.semester_id);return {...s,offerings:s.offering_count,enrollments:es.length,students:new Set(es.map(e=>e.student_id)).size};});
      default: return null;
    }
  };
  const distribution = () => all('SELECT grade_letter name,count(*) value FROM grade WHERE grade_letter IS NOT NULL GROUP BY grade_letter ORDER BY grade_letter');
  const group = (name) => {
    if(name==='students') return {by_department:report('students-by-department'),by_admission_year:report('students-by-year'),by_status:report('students-by-status')};
    if(name==='faculty') return {by_department:report('faculty-by-department'),assignments:report('faculty-assignments')};
    if(name==='grades') return {grade_distribution:distribution(),student_grades:report('grade-report')};
    if(name==='enrollments'||name==='academic') return {course_enrollment:report('course-enrollment'),capacity_utilization:report('capacity-utilization'),semester_summary:report('semester-summary'),...(name==='academic'?group('grades'):{})};
    return report(name);
  };
  return {report,group};
}
