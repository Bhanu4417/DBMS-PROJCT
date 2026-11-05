import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createService } from '../lib/api.mjs';

const directory=mkdtempSync(resolve(import.meta.dirname,'sqlite-test-'));
const service=createService({filename:resolve(directory,'test.sqlite')});
const call=(method,path,body,status=200)=>{const r=service.dispatch(method,`/api/${path}`,body);assert.equal(r.status,status,JSON.stringify(r));return r.body;};
let ids={};

test('seed counts, health, joined details, and options',()=>{
  const counts={departments:5,students:50,faculty:15,courses:20,semesters:4,offerings:30,assignments:20,enrollments:100,grades:60};
  for(const [key,n] of Object.entries(counts)) {assert.equal(call('GET',key).total,n);assert.ok(call('GET',`${key}/1`));}
  assert.equal(call('GET','health').foreign_keys,true);
  assert.equal(service.db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.ok(call('GET','students/1').enrollments.length);
  assert.ok(call('GET','faculty/1').assignments.length);
  assert.ok(call('GET','courses/1').offerings.length);
  assert.ok(call('GET','semesters/1/offerings').length);
  assert.ok(call('GET','offerings/1').students.length);
  for(const key of ['departments','students','faculty','courses','semesters','offerings','enrollments']) assert.ok(call('GET',`${key}/options`)[0].label);
  assert.equal(call('GET','enrollments/options?ungraded=true').length,40);
});

test('all nine tables support create, read, update and guarded reverse-order delete',()=>{
  const create=(key,data,pk)=>{const r=call('POST',key,data,201);ids[key]=r[pk];assert.equal(call('GET',`${key}/${r[pk]}`)[pk],r[pk]);return r[pk];};
  const d=create('departments',{department_code:'TEST',department_name:'Test Department'},'department_id');
  const s=create('students',{enrollment_number:'TEST001',first_name:'Test',last_name:'Student',email:'test@campus.edu',admission_year:2025,department_id:d},'student_id');
  const f=create('faculty',{employee_code:'TEST01',first_name:'Test',last_name:'Faculty',email:'teacher@campus.edu',department_id:d},'faculty_id');
  const c=create('courses',{course_code:'TEST-101',course_name:'Test Course',credits:4,department_id:d},'course_id');
  const sem=create('semesters',{semester_name:'Test Term',academic_year:'2026-2027',start_date:'2026-07-01',end_date:'2026-12-01'},'semester_id');
  const o=create('offerings',{course_id:c,semester_id:sem,section:'A',capacity:2},'offering_id');
  create('assignments',{faculty_id:f,offering_id:o},'assignment_id');
  const e=create('enrollments',{student_id:s,offering_id:o},'enrollment_id');
  create('grades',{enrollment_id:e,marks_obtained:80,grade_letter:'A'},'grade_id');
  const patches={departments:{office_location:'Test Block'},students:{last_name:'Updated'},faculty:{designation:'Professor'},courses:{credits:3},semesters:{status:'Active'},offerings:{capacity:3},assignments:{faculty_id:1},enrollments:{enrollment_status:'Completed'},grades:{marks_obtained:90}};
  for(const [key,patch] of Object.entries(patches)) {const r=call('PUT',`${key}/${ids[key]}`,patch);for(const [k,v] of Object.entries(patch)) assert.equal(r[k],v);}
  for(const key of ['departments','students','faculty','courses','semesters','offerings','enrollments']) {
    // Faculty was reassigned above, so only the newly unlinked faculty is deletable.
    if(key!=='faculty') call('DELETE',`${key}/${ids[key]}`,undefined,409);
  }
  for(const key of ['grades','enrollments','assignments','offerings','semesters','courses','faculty','students','departments']) {call('DELETE',`${key}/${ids[key]}`);call('GET',`${key}/${ids[key]}`,undefined,404);}
});

test('constraints, safe identifiers, invalid input, and readable errors',()=>{
  call('POST','departments',{department_code:'CSE',department_name:'Duplicate'},409);
  call('POST','courses',{course_code:'BAD-101',course_name:'Bad Foreign Key',credits:4,department_id:999999},409);
  call('POST','courses',{course_code:'BAD-101',course_name:'Bad Credits',credits:0,department_id:1},422);
  call('POST','students',{first_name:'Only'},422);
  call('PUT','students/1',{email:'invalid'},422);
  call('PUT','students/1',{status:'Unknown'},422);
  call('PUT','students/1',{gender:'Unknown'},422);
  call('PUT','semesters/1',{end_date:'2020-01-01'},422);
  call('PUT','grades/1',{grade_letter:'Z'},422);
  call('PUT','students/1',{first_name:'   '},422);
  call('PUT','students/1',{date_of_birth:'2025-02-30'},422);
  call('PUT','grades/1',{marks_obtained:101},422);
  call('PUT','grades/1',{max_marks:0},422);
  call('POST','grades',{enrollment_id:1,marks_obtained:50},409);
  call('POST','assignments',{faculty_id:1,offering_id:1},409);
  call('POST','enrollments',{student_id:1,offering_id:1},409);
  call('PUT','students/1',{'first_name = NULL; DROP TABLE student; --':'x'},422);
  call('GET','students?sort_by=first_name;DROP TABLE student',undefined,422);
  call('GET','students?page=-1',undefined,422);
  call('GET','students?page_size=201',undefined,422);
  call('GET','students?sort_dir=evil',undefined,422);
  call('GET','students/1/extra',undefined,404);
  call('GET','students/99999',undefined,404);
  call('PATCH','students/1',{},405);
  assert.equal(call('GET','students').total,50);
});

test('capacity: insert, dropped reactivation, moves, reduction, rollback and direct SQL trigger',()=>{
  const o=call('POST','offerings',{course_id:1,semester_id:4,section:'CAP',capacity:1},201).offering_id;
  const a=call('POST','enrollments',{student_id:1,offering_id:o},201).enrollment_id;
  call('POST','enrollments',{student_id:2,offering_id:o},409);
  const b=call('POST','enrollments',{student_id:2,offering_id:o,enrollment_status:'Dropped'},201).enrollment_id;
  call('PUT',`enrollments/${b}`,{enrollment_status:'Enrolled'},409);
  assert.equal(call('GET',`enrollments/${b}`).enrollment_status,'Dropped');
  assert.throws(()=>service.db.prepare('INSERT INTO enrollment(student_id,offering_id) VALUES(3,?)').run(o),/capacity/i);
  call('PUT',`enrollments/${a}`,{enrollment_status:'Dropped'});
  call('PUT',`enrollments/${b}`,{enrollment_status:'Enrolled'});
  call('PUT',`offerings/${o}`,{capacity:2});
  const c=call('POST','enrollments',{student_id:3,offering_id:o},201).enrollment_id;
  const moving=call('GET','enrollments?student_id=4').items[0];
  call('PUT',`enrollments/${moving.enrollment_id}`,{offering_id:o},409);
  assert.equal(call('GET',`enrollments/${moving.enrollment_id}`).offering_id,moving.offering_id);
  call('PUT',`offerings/${o}`,{capacity:1},409);
  assert.equal(call('GET',`offerings/${o}`).capacity,2);
  for(const id of [a,b,c]) call('DELETE',`enrollments/${id}`);
  call('DELETE',`offerings/${o}`);
});

test('search, filters, sort and pagination envelopes',()=>{
  const p=call('GET','students?department_id=1&sort_by=enrollment_number&sort_dir=desc&page_size=3&page=2');
  assert.equal(p.total,10);assert.equal(p.pages,4);assert.equal(p.items.length,3);
  assert.ok(p.items.every(s=>s.department_id===1));
  assert.ok(p.items[0].enrollment_number>p.items[1].enrollment_number);
  assert.ok(call('GET','courses?search=database').items[0].course_name.includes('Database'));
  assert.ok(call('GET','grades?course_id=1').items.every(r=>r.course_id===1));
  assert.equal(call('GET','enrollments?has_grade=true').total,60);
});

test('database SQL snapshot exports current schema and persisted CRUD records',()=>{
  const result=service.dispatch('GET','/api/database/export.sql');
  assert.equal(result.status,200);
  assert.match(result.headers['Content-Type'],/application\/sql/);
  assert.match(result.body,/CREATE TABLE department/);
  assert.match(result.body,/CREATE TABLE student/);
  assert.match(result.body,/INSERT INTO "department"/);
  const created=call('POST','departments',{department_code:'SQLX',department_name:'SQL Snapshot Test'} ,201);
  const snapshot=service.dispatch('GET','/api/database/export.sql').body;
  assert.match(snapshot,new RegExp(`SQL Snapshot Test`));
  call('DELETE',`departments/${created.department_id}`);
});

 test('dashboard and report aggregates, catalog, CSV export and unknown reports',()=>{
  const stats=call('GET','dashboard/stats');assert.equal(stats.total_students,50);assert.equal(stats.total_enrollments,100);
  const charts=call('GET','dashboard/charts');assert.equal(charts.students_by_department.reduce((n,r)=>n+r.value,0),50);
  assert.equal(call('GET','dashboard/activity?limit=3').recent_students.length,3);
  assert.equal(call('GET','reports/students').by_department.reduce((n,r)=>n+r.students,0),50);
  assert.equal(call('GET','reports/faculty').assignments.length,20);
  assert.equal(call('GET','reports/grades').student_grades.length,60);
  assert.equal(call('GET','reports/enrollments').capacity_utilization.length,30);
  assert.equal(call('GET','reports/academic').semester_summary.reduce((n,r)=>n+r.enrollments,0),100);
  for(const r of call('GET','reports')) {
    const csv=service.dispatch('GET',`/api/reports/export?report=${r.key}`);
    assert.equal(csv.status,200);assert.ok(csv.headers['Content-Type'].startsWith('text/csv'));
    assert.equal(csv.body.split('\r\n')[0],r.columns.map(c=>`"${c}"`).join(','));
  }
  call('GET','reports/export?report=unknown',undefined,404);
});

test('file persists independently without Python and workspace boundaries are enforced',()=>{
  const second=createService({filename:resolve(directory,'test.sqlite')});assert.equal(second.dispatch('GET','/api/students').body.total,50);second.close();
  assert.throws(()=>createService({filename:'/tmp/not-permitted.sqlite'}),/workspace/);
  service.close();rmSync(directory,{recursive:true,force:true});
});
