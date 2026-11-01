export function seed(db) {
  const insert = (table, data) => db.prepare(`INSERT INTO ${table} (${Object.keys(data)}) VALUES (${Object.keys(data).map(()=>'?')})`).run(...Object.values(data));
  const departments = [['CSE','Computer Science and Engineering'],['ECE','Electronics and Communication'],['ME','Mechanical Engineering'],['CE','Civil Engineering'],['MBA','Business Administration']];
  departments.forEach(([department_code,department_name],i)=>insert('department',{department_code,department_name,office_location:`Block ${String.fromCharCode(65+i)}, Room 101`}));
  const first = ['Aarav','Diya','Arjun','Ananya','Rohan','Ishita','Kabir','Meera','Vivaan','Sara'];
  const last = ['Sharma','Patel','Reddy','Singh','Nair'];
  for(let i=0;i<50;i++) insert('student',{enrollment_number:`ENR${2021+i%5}${String(i+1).padStart(3,'0')}`,first_name:first[i%10],last_name:last[Math.floor(i/10)],email:`student${i+1}@campus.edu.in`,phone:`98765${String(i).padStart(5,'0')}`,date_of_birth:`2003-05-${String(i%28+1).padStart(2,'0')}`,gender:i%2?'Female':'Male',admission_year:2021+i%5,department_id:i%5+1,status:i%11===0?'Graduated':i%13===0?'Inactive':'Active'});
  for(let i=0;i<15;i++) insert('faculty',{employee_code:`FAC-${1001+i}`,first_name:first[(i+3)%10],last_name:last[i%5],email:`faculty${i+1}@campus.edu.in`,designation:i%3?'Assistant Professor':'Professor',joining_date:`201${i%10}-07-01`,department_id:i%5+1});
  const names = ['Database Management Systems','Digital Electronics','Engineering Mechanics','Structural Analysis','Business Strategy','Data Structures','Communication Systems','Thermodynamics','Surveying','Financial Management','Operating Systems','Signal Processing','Manufacturing Processes','Environmental Engineering','Marketing Management','Computer Networks','Microprocessors','Machine Design','Transportation Engineering','Organizational Behaviour'];
  for(let i=0;i<20;i++) insert('course',{course_code:`${departments[i%5][0]}-${301+Math.floor(i/5)}`,course_name:names[i],credits:i%3===0?3:4,department_id:i%5+1,description:`Core concepts and practical applications of ${names[i].toLowerCase()}.`});
  for(let i=0;i<4;i++) insert('semester',{semester_name:i%2?'Even Semester':'Odd Semester',academic_year:i<2?'2024-2025':'2025-2026',start_date:`${2024+Math.floor((i+1)/2)}-${i%2?'01':'07'}-01`,end_date:`${2024+Math.floor((i+1)/2)}-${i%2?'05':'11'}-30`,status:i<2?'Completed':i===2?'Active':'Upcoming'});
  for(let i=0;i<30;i++) insert('course_offering',{course_id:i%20+1,semester_id:Math.floor(i/10)+1,section:'A',capacity:30+i%4*10});
  for(let i=0;i<20;i++) insert('faculty_assignment',{faculty_id:i%15+1,offering_id:i+1});
  for(let i=0;i<100;i++) insert('enrollment',{student_id:i%50+1,offering_id:(i%50+Math.floor(i/50)*7)%30+1,enrollment_date:`2025-07-${String(i%28+1).padStart(2,'0')}`,enrollment_status:i<60?'Completed':i%9===0?'Dropped':'Enrolled'});
  for(let i=0;i<60;i++) {const marks=42+(i*7)%57;insert('grade',{enrollment_id:i+1,marks_obtained:marks,max_marks:100,grade_letter:marks>=90?'A+':marks>=80?'A':marks>=70?'B+':marks>=60?'B':marks>=50?'C':'D'});}
}
