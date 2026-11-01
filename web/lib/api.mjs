import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schema } from './schema.mjs';
import { queries, resources, capacityTriggers } from './queries.mjs';
import { seed } from './seed.mjs';
import { reporting, reportDefinitions } from './reports.mjs';

const workspace = resolve(process.cwd(), process.cwd().endsWith('/web') ? '..' : '.');
const fail = (status, detail) => { throw Object.assign(new Error(detail), { status }); };
const inside = (path) => { const rel=relative(workspace,path); return rel!== '..' && !rel.startsWith('../') && !isAbsolute(rel); };
const integer = (v, label, min=1, max=Number.MAX_SAFE_INTEGER) => {
  if (!/^\d+$/.test(String(v)) || !Number.isSafeInteger(Number(v)) || Number(v)<min || Number(v)>max) fail(422, `${label} must be an integer between ${min} and ${max}`);
  return Number(v);
};

/** Dedicated file may be supplied by tests; files outside this workspace are rejected. */
export function createService({ filename = resolve(workspace, 'web/lib/.data/campus.sqlite'), seed: shouldSeed = true } = {}) {
  filename=resolve(filename);
  if(!inside(filename)) throw new Error('Database must be inside the workspace');
  // Check existing ancestors before mkdir, preventing writes through symlinked directories.
  let ancestor=dirname(filename);
  for (;;) { try { if(!inside(realpathSync(ancestor))) throw new Error('Database directory escapes workspace'); break; } catch(e) { if(e.code!=='ENOENT') throw e; ancestor=dirname(ancestor); } }
  mkdirSync(dirname(filename),{recursive:true});
  try { if(!inside(realpathSync(filename))) throw new Error('Database symlink escapes workspace'); } catch(e) { if(e.code!=='ENOENT') throw e; }
  const db=new DatabaseSync(filename);
  db.function('regexp',{deterministic:true},(pattern,value)=>value===null?0:Number(new RegExp(pattern).test(String(value))));
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  /** Target facility: wrap a scalar function so every write it makes is atomic.
   *  Alternatives: savepoints per statement (verbose, bug-prone) or no wrap at all
   *  (a mid-write failure would leave half a record). */
  const transaction = (fn) => { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } };
  transaction(()=>{
    if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='department'").get()) {
      db.exec(schema); db.exec(capacityTriggers); if(shouldSeed) seed(db);
    } else db.exec(capacityTriggers);
  });
  const all=(sql,...args)=>db.prepare(sql).all(...args).map(r=>({...r}));
  const rows=(key)=>all(queries[key]);
  const reports=reporting(all,rows);
  const detail=(key,id)=> {
    const r=all(`SELECT * FROM (${queries[key]}) WHERE ${resources[key][1]}=?`,id)[0];
    if(!r) fail(404,`${key} record not found`);
    if(key==='students') r.enrollments=rows('enrollments').filter(e=>e.student_id===id);
    if(key==='faculty') r.assignments=rows('assignments').filter(a=>a.faculty_id===id);
    if(key==='courses') r.offerings=rows('offerings').filter(o=>o.course_id===id);
    if(key==='semesters') r.offerings=rows('offerings').filter(o=>o.semester_id===id);
    if(key==='offerings') {r.students=rows('enrollments').filter(e=>e.offering_id===id);r.faculty=rows('assignments').filter(a=>a.offering_id===id);}
    return r;
  };
  function validate(key,body,old) {
    if(!body || typeof body!=='object' || Array.isArray(body)) fail(422,'A JSON object is required');
    const fields=resources[key][2].split(' '), data={};
    for(const [field,value] of Object.entries(body)) {
      if(!fields.includes(field)) fail(422,`Unknown field: ${field}`);
      data[field]=typeof value==='string'?value.trim():value;
      if(data[field]==='') data[field]=null;
      if(data[field]!==null && typeof data[field]==='object') fail(422,`${field} must be a scalar value`);
    }
    if(!old) {
      if(key==='students' && !('status' in data)) data.status='Active';
      if(key==='semesters' && !('status' in data)) data.status='Upcoming';
      if(key==='enrollments') { if(!data.enrollment_date) data.enrollment_date=new Date().toISOString().slice(0,10);if(!('enrollment_status' in data)) data.enrollment_status='Enrolled'; }
      if(key==='grades' && !('max_marks' in data)) data.max_marks=100;
    }
    const merged={...old,...data};
    const required={departments:'department_code department_name',students:'enrollment_number first_name last_name email admission_year status',faculty:'employee_code first_name last_name email department_id',courses:'course_code course_name credits department_id',semesters:'semester_name academic_year start_date end_date status',offerings:'course_id semester_id section capacity',assignments:'faculty_id offering_id',enrollments:'student_id offering_id enrollment_date enrollment_status',grades:'enrollment_id max_marks'}[key].split(' ');
    for(const f of required) if(merged[f]===null || merged[f]===undefined) fail(422,`${f} is required`);
    for(const [f,v] of Object.entries(data)) {
      if(v===null) continue;
      if(f.endsWith('_id')) data[f]=integer(v,f);
      else if(['admission_year','credits','capacity'].includes(f)) data[f]=integer(v,f,f==='admission_year'?2000:1,f==='admission_year'?2100:f==='credits'?6:500);
      else if(['marks_obtained','max_marks'].includes(f)) { if((typeof v!=='number' && typeof v!=='string') || !Number.isFinite(Number(v)) || Number(v)<0 || (f==='max_marks' && Number(v)===0)) fail(422,`${f} must be a valid ${f==='max_marks'?'positive':'non-negative'} number`);data[f]=Number(v); }
      else if(typeof v!=='string') fail(422,`${f} must be text`);
      if(typeof v==='string') {
        const lengths={department_code:[2,10],department_name:[3,100],office_location:[0,100],enrollment_number:[3,30],employee_code:[2,30],first_name:[1,50],last_name:[1,50],email:[3,150],phone:[7,15],designation:[0,100],course_code:[3,20],course_name:[3,150],description:[0,2000],semester_name:[2,50],academic_year:[9,9],section:[1,20]};
        const [min,max]=lengths[f]||[0,150];
        if(v.length<min||v.length>max) fail(422,`${f} must contain ${min}–${max} characters`);
      }
      if(f==='email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) fail(422,'Enter a valid email address');
      if(f==='phone' && !/^[0-9+ -]{7,15}$/.test(v)) fail(422,'Phone must contain 7–15 digits, spaces, + or -');
      if(f.endsWith('_date') || f==='date_of_birth') {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10)!==v) fail(422,`${f} must be a valid YYYY-MM-DD date`);
        if(f==='date_of_birth' && (v<'1930-01-01'||v>=new Date().toISOString().slice(0,10))) fail(422,'Date of birth must be plausible and in the past');
      }
    }
    const m={...old,...data};
    if(key==='departments' && !/^[A-Z]{2,10}$/.test(m.department_code)) fail(422,'Department code must be 2–10 uppercase letters');
    if(key==='courses' && !/^[A-Z]{2,6}-?[0-9]{3,4}$/.test(m.course_code)) fail(422,'Course code must look like CSE-301');
    if(key==='semesters' && (!/^\d{4}-\d{4}$/.test(m.academic_year)||m.end_date<=m.start_date)) fail(422,'Use academic year YYYY-YYYY and an end date later than the start date');
    if(key==='grades' && m.marks_obtained!=null && m.marks_obtained>m.max_marks) fail(422,'Marks obtained cannot exceed maximum marks');
    return data;
  }
  function filtered(key,q) {
    let result=rows(key);
    const filters=['department_id','student_id','faculty_id','offering_id','course_id','semester_id','status','admission_year','designation','academic_year','section','enrollment_status','grade_letter'];
    for(const f of filters) if(q.has(f) && q.get(f)!=='') { const value=f.endsWith('_id')||f==='admission_year'?integer(q.get(f),f):q.get(f);result=result.filter(r=>r[f]===value); }
    if(q.get('search')) {const term=q.get('search').trim().toLowerCase();result=result.filter(r=>Object.values(r).some(v=>typeof v==='string' && v.toLowerCase().includes(term)));}
    if(q.has('min_credits')) result=result.filter(r=>r.credits>=integer(q.get('min_credits'),'min_credits',1,6));
    for(const f of ['has_grade','ungraded','only_available']) if(q.has(f)) {
      if(!['true','false'].includes(q.get(f))) fail(422,`${f} must be true or false`);
      const yes=q.get(f)==='true';
      if(f==='has_grade') result=result.filter(r=>Boolean(r.grade_id)===yes);
      if(f==='ungraded'&&yes) result=result.filter(r=>!r.grade_id);
      if(f==='only_available'&&yes) result=result.filter(r=>r.seats_available>0);
    }
    const aliases={name:key==='departments'?'department_name':key==='courses'?'course_name':key==='semesters'?'semester_name':'full_name',code:key==='departments'?'department_code':'course_code',start:'start_date',course:'course_code',semester:'start_date',faculty:'faculty_name',student:'student_name',marks:'marks_obtained',date:key==='assignments'?'assigned_at':'enrollment_date'};
    const sort=q.get('sort_by')||resources[key][3];
    const column=Object.hasOwn(aliases,sort)?aliases[sort]:sort;
    const columns=Object.keys(db.prepare(`SELECT * FROM (${queries[key]}) LIMIT 0`).columns().reduce((o,c)=>(o[c.name]=true,o),{}));
    if(!columns.includes(column)) fail(422,'Unknown sort field');
    const dir=q.get('sort_dir')||(['semesters','enrollments'].includes(key)?'desc':'asc');
    if(!['asc','desc'].includes(dir)) fail(422,'sort_dir must be asc or desc');
    result.sort((a,b)=>{const x=a[column],y=b[column]; const c=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''));return (dir==='desc'?-c:c)||a[resources[key][1]]-b[resources[key][1]];});
    return result;
  }
  function dashboard(section,q) {
    if(section==='stats') return {...Object.fromEntries(Object.entries(resources).map(([key,[table]])=>[`total_${key}`,all(`SELECT count(*) n FROM ${table}`)[0].n])),active_enrollments:all("SELECT count(*) n FROM enrollment WHERE enrollment_status='Enrolled'")[0].n,active_semesters:all("SELECT count(*) n FROM semester WHERE status='Active'")[0].n};
    if(section==='charts') return {students_by_department:rows('departments').map(d=>({name:d.department_code,full_name:d.department_name,value:d.student_count})),admissions_by_year:reports.report('students-by-year').map(r=>({year:r.admission_year,value:r.students})),enrollment_distribution:all('SELECT enrollment_status name,count(*) value FROM enrollment GROUP BY enrollment_status'),offerings_by_semester:rows('semesters').map(s=>({name:`${s.semester_name} ${s.academic_year}`,value:s.offering_count}))};
    if(section==='activity') {const limit=q.has('limit')?integer(q.get('limit'),'limit',1,20):5;return {recent_students:rows('students').sort((a,b)=>b.student_id-a.student_id).slice(0,limit).map(s=>({...s,student_name:s.full_name})),recent_enrollments:rows('enrollments').sort((a,b)=>b.enrollment_id-a.enrollment_id).slice(0,limit),popular_courses:reports.report('course-enrollment').slice(0,limit),department_overview:rows('departments').map(d=>({...d,students:d.student_count,faculty:d.faculty_count,courses:d.course_count}))};}
    fail(404,'Dashboard endpoint not found');
  }
  /** Synchronous dispatch returns {status, body, headers}; no HTTP server required. */
  function dispatch(method,path,body) {
    try {
      const url=new URL(path,'http://localhost');
      const parts=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
      const [key,segment,sub]=parts,q=url.searchParams;
      method=method.toUpperCase();
      if(parts.length>3) fail(404,'Endpoint not found');
      if(method==='GET' && key==='health' && !segment) return {status:200,body:{status:'ok',database:'sqlite',foreign_keys:db.prepare('PRAGMA foreign_keys').get().foreign_keys===1}};
      if(method==='GET' && key==='dashboard' && !sub) return {status:200,body:dashboard(segment,q)};
      if(method==='GET' && key==='reports' && !sub) {
        if(!segment) return {status:200,body:Object.entries(reportDefinitions).map(([key,[title,columns]])=>({key,title,columns:columns.split(' ')}))};
        if(segment==='export') {
          const name=q.get('report'),meta=Object.hasOwn(reportDefinitions,name)?reportDefinitions[name]:null;if(!meta) fail(404,'Unknown report');
          const columns=meta[1].split(' ');
          const escape=v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
          return {status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${name}.csv"`},body:[columns,...reports.report(name).map(r=>columns.map(c=>r[c]))].map(r=>r.map(escape).join(',')).join('\r\n')+'\r\n'};
        }
        const result=reports.group(segment);if(!result) fail(404,'Unknown report');return {status:200,body:result};
      }
      if(!Object.hasOwn(resources,key)) fail(404,'Endpoint not found');
      const [table,pk]=resources[key];
      if(segment==='options' && !sub && method==='GET') return {status:200,body:filtered(key,q).slice(0,500).map(r=>({value:r[pk],label:key==='departments'?r.department_name:key==='students'?`${r.full_name} (${r.enrollment_number})`:key==='faculty'?`${r.full_name} (${r.employee_code})`:key==='semesters'?`${r.semester_name} ${r.academic_year} (${r.status})`:key==='courses'?`${r.course_code} — ${r.course_name}`:key==='offerings'?`${r.course_code} — ${r.course_name} · ${r.semester_name} ${r.academic_year} · Sec ${r.section} (${r.seats_available}/${r.capacity} seats free)`:`${r.student_name} (${r.enrollment_number}) — ${r.course_code} ${r.course_name} · ${r.semester_name} ${r.academic_year}`,meta:key==='semesters'?r.status:key==='offerings'?String(r.seats_available):null}))};
      const id=segment?integer(segment,'Record ID'):null;
      if(sub && !(method==='GET'&&key==='semesters'&&sub==='offerings')) fail(404,'Endpoint not found');
      if(method==='GET') {
        if(id) {const r=detail(key,id);return {status:200,body:sub?r.offerings:r};}
        const page=q.has('page')?integer(q.get('page'),'page'):1,size=q.has('page_size')?integer(q.get('page_size'),'page_size',1,200):10;
        const result=filtered(key,q);return {status:200,body:{items:result.slice((page-1)*size,page*size),total:result.length,page,page_size:size,pages:Math.ceil(result.length/size)}};
      }
      if(method==='POST'&&!id || method==='PUT'&&id || method==='DELETE'&&id) return transaction(()=>{
        const old=id?all(`SELECT * FROM ${table} WHERE ${pk}=?`,id)[0]:null;
        if(id&&!old) fail(404,'Record not found');
        if(method==='DELETE') {db.prepare(`DELETE FROM ${table} WHERE ${pk}=?`).run(id);return {status:200,body:{detail:'Record deleted'}};}
        const data=validate(key,body,old),fields=Object.keys(data);
        if(!fields.length) fail(422,'No fields supplied');
        let resultId=id;
        if(id) db.prepare(`UPDATE ${table} SET ${fields.map(f=>`${f}=?`).join(',')} WHERE ${pk}=?`).run(...Object.values(data),id);
        else resultId=Number(db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).run(...Object.values(data)).lastInsertRowid);
        return {status:id?200:201,body:detail(key,resultId)};
      });
      fail(405,'Method not allowed for this endpoint');
    } catch(e) {
      let status=e.status, message=e.message;
      if(!status) {
        if(/UNIQUE constraint/.test(message)) {
          status=409;
          const friendly=[[/(student|faculty)\.email/,'That email address is already used'],[/enrollment_number/,'That enrollment number is already used'],[/employee_code/,'That employee code is already used'],[/course_code/,'That course code is already used'],[/department_(code|name)/,'That department value is already used'],[/semester_name/,'That semester name is already used'],[/offering_id.*faculty|faculty.*offering|assignment/,'That faculty member is already assigned to this course offering'],[/enrollment/,'The student is already enrolled in this course offering'],[/enrollment_id.*grade|grade.*enrollment/,'A grade already exists for this enrollment']];
          const dup=friendly.find(([pattern])=>pattern.test(message));
          message=dup?dup[1]:`A record with these values already exists (${message.split(':').slice(1).join(':').trim()})`;
        }
        else if(/FOREIGN KEY/.test(message)) {status=409;message='Related record does not exist, or this record has dependent academic history. Remove dependent records first.';}
        else if(/capacity|current enrollment/i.test(message)) status=409;
        else if(/CHECK constraint|NOT NULL/.test(message)) {status=422;message=`Invalid value: ${message}`;}
        else if(/locked|busy/i.test(message)) {status=503;message='Database is busy; please retry.';}
        else {status=500;message='Unable to complete database operation';}
      }
      return {status,body:{detail:message}};
    }
  }
  return { dispatch, close:()=>db.close(), db };
}
let singleton;
export function dispatch(method,path,body) {singleton??=createService();return singleton.dispatch(method,path,body);}
