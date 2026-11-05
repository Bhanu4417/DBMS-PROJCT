import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { schema } from '../web/lib/schema.mjs';
import puppeteer from '../web/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

// Read-only extraction of the current implementation; no application database is opened.
const portal = fs.readFileSync(new URL('../web/lib/portal.mjs', import.meta.url), 'utf8');
const db = new DatabaseSync(':memory:');
db.function('regexp', (pattern, value) => new RegExp(pattern).test(value) ? 1 : 0);
db.exec(schema);
const extension = [...portal.matchAll(/CREATE TABLE IF NOT EXISTS [\s\S]*?\)(?=;|')/g)].map(m => m[0]);
for (const sql of extension) db.exec(sql);
const tables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all().map(t => ({
  ...t,
  columns: db.prepare(`PRAGMA table_info(${t.name})`).all(),
  fks: db.prepare(`PRAGMA foreign_key_list(${t.name})`).all(),
  unique: db.prepare(`PRAGMA index_list(${t.name})`).all().filter(i => i.unique && i.origin !== 'pk').map(i => db.prepare(`PRAGMA index_info('${i.name}')`).all().map(c => c.name)),
}));
if (tables.length !== 16) throw Error(`Schema changed: expected 16 tables, found ${tables.length}; review layout.`);
fs.writeFileSync('learnit/CampusOS_schema.json', JSON.stringify(tables, null, 2) + '\n');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let parts;
function start(w,h,title,subtitle) {
  parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><style>text{font-family:Arial,Helvetica,sans-serif;fill:#111} .line{fill:none;stroke:#222;stroke-width:2} .key{text-decoration:underline;font-weight:bold} .small{font-size:17px} .body{font-size:20px} .mono{font-family:monospace;font-size:18px}</style><rect width="100%" height="100%" fill="white"/>`];
  text(65,65,title,36,'font-weight="bold"'); text(65,105,subtitle,19);
}
function text(x,y,s,size=20,attrs='') { parts.push(`<text x="${x}" y="${y}" font-size="${size}" ${attrs}>${esc(s)}</text>`); }
function rect(x,y,w,h,attrs='') { parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white" stroke="#111" stroke-width="2" ${attrs}/>`); }
function line(points,attrs='') { parts.push(`<polyline points="${points.map(p=>p.join(',')).join(' ')}" class="line" ${attrs}/>`); }
function finish(name) { parts.push('</svg>'); fs.writeFileSync(`learnit/${name}.svg`,parts.join('\n')+'\n'); }
const positions = {
  faculty:[0,0], department:[1,0], course:[2,0],
  faculty_assignment:[0,1], course_offering:[1,1], semester:[2,1],
  student:[0,2], enrollment:[1,2], grade:[2,2],
  library_book:[0,3], library_loan:[1,3], attendance:[2,3],
  portal_account:[3,0], portal_session:[3,1], login_throttle:[3,2], portal_migration:[3,3],
};
const relationNames = {
 'faculty.department_id':'belongs to', 'student.department_id':'belongs to', 'course.department_id':'offers',
 'course_offering.course_id':'instance of', 'course_offering.semester_id':'scheduled in',
 'faculty_assignment.faculty_id':'assigned via', 'faculty_assignment.offering_id':'staffed via',
 'enrollment.student_id':'registers', 'enrollment.offering_id':'receives', 'grade.enrollment_id':'assessed by',
 'attendance.enrollment_id':'records', 'library_loan.student_id':'borrows via', 'library_loan.book_id':'loaned via',
 'portal_account.student_id':'linked account', 'portal_session.account_id':'owns session',
};
const refs=[];
for (const t of tables) for (const fk of t.fks) {
  const col=t.columns.find(c=>c.name===fk.from);
  const unique=t.unique.some(u=>u.length===1&&u[0]===fk.from);
  refs.push({id:`R${refs.length+1}`,child:t.name,parent:fk.table,from:fk.from,to:fk.to, min:col.notnull?1:0,max:unique?'1':'N',...fk});
}
// Chen-inspired domain overview: associations remain entities when they have identity/history.
start(2700,3070,'CampusOS | Conceptual domain ER','CURRENT EXTENDED MODEL  /  12 domain entities  /  Chen-inspired notation  /  Authentication is separated in the relational plate');
text(65,148,'Underlined ellipse = primary key   •   Edge labels = min..max related rows per entity at that endpoint   •   Selected attributes shown; full schema in relational plate',17);
const centers = Object.fromEntries(Object.entries(positions).filter(([,p])=>p[0]<3).map(([n,[c,r]])=>[n,[500+c*820,450+r*700]]));
const selected={
 department:['department_id','department_code','department_name','office_location'],
 faculty:['faculty_id','employee_code','first_name','last_name','email','designation'],
 course:['course_id','course_code','course_name','credits','description'],
 semester:['semester_id','semester_name','academic_year','start_date','end_date','status'],
 course_offering:['offering_id','section','capacity','created_at'],
 faculty_assignment:['assignment_id','assigned_at'],
 student:['student_id','enrollment_number','first_name','last_name','email','status'],
 enrollment:['enrollment_id','enrollment_date','enrollment_status'],
 grade:['grade_id','marks_obtained','max_marks','grade_letter','updated_at'],
 attendance:['attendance_id','date','status'],
 library_book:['book_id','isbn','title','author','copies'],
 library_loan:['loan_id','borrowed_date','due_date','returned_date'],
};
function diamond(x,y,label) {
 parts.push(`<polygon points="${x-79},${y} ${x},${y-42} ${x+79},${y} ${x},${y+42}" fill="white" stroke="#111" stroke-width="2"/>`);
 for(const [i,s] of label.split(' ').entries()) text(x,y-6+i*18,s,16,'text-anchor="middle"');
}
// Individual long routes use reserved outer/mid-row corridors, not entity interiors.
const routes={
 'student.department_id': [[500,1818],[75,1818],[75,195],[1320,195],[1320,418]],
 'library_loan.student_id': [[1320,2582],[1320,2810],[95,2810],[95,1940],[500,1940],[500,1882]],
};
for(const r of refs.filter(r=>centers[r.child]&&centers[r.parent])) {
 const [cx,cy]=centers[r.child], [px,py]=centers[r.parent];
 let points=routes[`${r.child}.${r.from}`];
 if(!points) points=cx===px?[[cx,cy+(py>cy?32:-32)],[px,py+(cy>py?32:-32)]]:[[cx+(px>cx?145:-145),cy],[px+(cx>px?145:-145),py]];
 line(points);
 let mid;
 if(routes[`${r.child}.${r.from}`]) mid=r.child==='student'?[75,1090]:[1320,2770];
 else mid=[(cx+px)/2,(cy+py)/2];
 diamond(...mid,relationNames[`${r.child}.${r.from}`]);
 const a=points[0], b=points.at(-1);
 // Labels report each entity's possible count of the opposite endpoint.
 text(a[0]+12,a[1]+(py>cy?35:-15),`${r.min}..1`,17);
 text(b[0]+12,b[1]+(cy>py?35:-15),`0..${r.max}`,17);
}
for(const [name,[x,y]] of Object.entries(centers)) {
 const attrs=selected[name];
 const spots=[[0,-182],[-165,-105],[165,-105],[-165,115],[165,115],[0,190]];
 attrs.forEach((attr,i)=>{
   const [dx,dy]=spots[i], ax=x+dx,ay=y+dy;
   line([[x,y],[ax,ay]]);
   parts.push(`<ellipse cx="${ax}" cy="${ay}" rx="145" ry="31" fill="white" stroke="#222" stroke-width="1.6"/>`);
   text(ax,ay+6,attr,18,`text-anchor="middle" ${i===0?'class="key"':''}`);
 });
 rect(x-145,y-32,290,64); text(x,y+7,name,23,'text-anchor="middle" font-weight="bold"');
}
text(65,2920,'Scope: academic9 + attendance + library_book + library_loan. Associative entities preserve assignment, enrollment and loan identities.',21);
text(65,2960,'No ISA hierarchy: faculty is an independent entity; admin/student are account role values, not faculty/student subclasses.',21);
text(65,3000,'Inspired by the supplied hospital report, page 2: entity rectangles, relationship diamonds, attribute ellipses, underlined keys; topology is CampusOS-specific.',18);
finish('CampusOS_Conceptual_ER');

// Full physical relational plate. All columns and declared UNIQUE/FK constraints come from SQLite introspection.
start(2980,3490,'CampusOS | Full relational ER','IMPLEMENTATION PLATE  /  16 tables  /  Exact column names and SQL types  /  Domain (12) and technical auth/support (4)');
text(65,148,'PK = primary key (underlined)   FK = foreign key   UQ = unique   NN = NOT NULL   ? = nullable declaration   D = SQL default',18);
text(65,179,'R# identifies an FK connector and the precise relationship register below. Counts: child → parent; parent → child. Lines are not inheritance.',18);
parts.push('<rect x="2265" y="205" width="660" height="2810" fill="none" stroke="#555" stroke-width="2" stroke-dasharray="12 8"/>');
text(2300,242,'TECHNICAL AUTH / SUPPORT',23,'font-weight="bold"');
const cards={};
for(const t of tables) {
 const [c,r]=positions[t.name]; const x=90+c*730,y=285+r*680;
 const lines=t.columns.length;
 const h=92+lines*28+Math.max(1,t.unique.length)*26+45;
 cards[t.name]={x,y,w:560,h};
}
// Draw routed FK edges first, so no connector obscures attribute text.
for(const [i,r] of refs.entries()) {
 const a=cards[r.child],b=cards[r.parent];
 const ci=tables.find(t=>t.name===r.child).columns.findIndex(c=>c.name===r.from);
 const ay=a.y+85+ci*28, by=b.y+85;
 const samecol=a.x===b.x;
 const ax=samecol?a.x:a.x+(a.x<b.x?a.w:0), bx=samecol?b.x:b.x+(a.x<b.x?0:b.w);
 const lane=samecol?a.x-25-(i%3)*16:(a.x<b.x?a.x+a.w+35+(i%4)*20:a.x-35-(i%4)*20);
 const pts=[[ax,ay],[lane,ay],[lane,by],[bx,by]];
 line(pts,'stroke="white" stroke-width="7"'); line(pts);
 text(lane+5,ay-8,r.id,16,'font-weight="bold"');
}
for(const t of tables) {
 const {x,y,w,h}=cards[t.name];
 rect(x,y,w,h); line([[x,y+49],[x+w,y+49]]);
 text(x+18,y+32,t.name,25,'font-weight="bold"');
 t.columns.forEach((c,i)=>{
   const fk=refs.find(r=>r.child===t.name&&r.from===c.name);
   let flags=[c.pk?'PK':'',fk?`FK ${fk.id}`:'',t.unique.some(u=>u.length===1&&u[0]===c.name)?'UQ':'',c.notnull?'NN':c.pk?'':'?'].filter(Boolean).join(' ');
   text(x+17,y+83+i*28,c.name,18,c.pk?'class="key"':'class="mono"');
   text(x+315,y+83+i*28,c.type,16,'font-family="monospace"');
   text(x+425,y+83+i*28,flags,14);
 });
 let yy=y+95+t.columns.length*28;
 line([[x,yy-6],[x+w,yy-6]]);
 for(const u of t.unique) { text(x+15,yy+17,`UQ (${u.join(', ')})`,15); yy+=26; }
 if(!t.unique.length) {text(x+15,yy+17,'No additional UNIQUE constraint',15);yy+=26;}
 const defaults=t.columns.filter(c=>c.dflt_value!==null);
 if(defaults.length) text(x+15,yy+16,`D: ${defaults.map(c=>`${c.name}=${c.dflt_value}`).join('; ')}`,14);
}
text(90,3035,'FOREIGN-KEY RELATIONSHIP REGISTER',23,'font-weight="bold"');
refs.forEach((r,i)=>{
 const col=i<8?0:1, row=i<8?i:i-8;
 text(90+col*1440,3070+row*30,`${r.id}  ${r.child}.${r.from} → ${r.parent}.${r.to}   [${r.min}..1 ; 0..${r.max}]`,17);
});
text(90,3340,'All FK deletes RESTRICT except portal_session.account_id CASCADE. Academic FK updates CASCADE; extension FK updates default NO ACTION.',18);
text(90,3375,'portal_account: role ∈ {admin, student}; admin ⇒ student_id NULL; student ⇒ student_id NOT NULL. student_id is UNIQUE; no faculty FK.',18);
text(90,3410,'login_throttle and portal_migration have no FKs. SQL CHECKs, defaults, nullable TEXT primary-key caveat and application rules: see Portal_ER.md and schema JSON.',18);
text(90,3445,'Sources: web/lib/schema.mjs + web/lib/portal.mjs • Editable SVG + reproducible generator • Original nine-table ER assets retained as historical.',18);
finish('CampusOS_Relational_ER');

// Render with the installed Chromium and the project's existing puppeteer-core.
const browser = await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--allow-file-access-from-files']});
try {
 for (const name of ['CampusOS_Conceptual_ER','CampusOS_Relational_ER']) {
  const page=await browser.newPage();
  const dims=name.includes('Conceptual')?[2700,3070]:[2980,3490];
  await page.setViewport({width:dims[0],height:dims[1],deviceScaleFactor:1});
  await page.goto(`file://${path.resolve(`learnit/${name}.svg`)}`);
  await page.screenshot({path:`learnit/${name}.png`,fullPage:true});
  if(name.includes('Conceptual')) await page.pdf({path:`learnit/${name}.pdf`,width:`${dims[0]}px`,height:`${dims[1]}px`,printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
  await page.close();
 }
} finally {await browser.close();db.close();}
console.log(`Generated and rendered 16 tables, ${refs.length} foreign keys.`);
