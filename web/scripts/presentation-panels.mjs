// Local presentation helper: browsers must be started with debugging ports 9223/9224.
// Mirrors the admin-visible redacted activity into a separate SQLite file for DBeaver.
// It cannot recover events already evicted from the application's 200-event buffer.
import puppeteer from 'puppeteer-core';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
mkdirSync(resolve(root,'.presentation'),{recursive:true});
const browsers=[];
async function open(port,email,password){
 const browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${port}`});browsers.push(browser);
 const pages=await browser.pages();const page=pages.find(p=>p.url().includes('localhost:3000'))??await browser.newPage();
 await page.goto('http://localhost:3000/',{waitUntil:'networkidle2'});
 const result=await page.evaluate(async({email,password})=>{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});return {status:response.status,body:await response.json()};},{email,password});
 if(result.status!==200)throw new Error(`Login failed (${result.status}): ${result.body.detail}`);
 await page.reload({waitUntil:'networkidle2'});return page;
}
const admin=await open(9223,'admin@campus.local','CampusAdmin!2026');
await open(9224,'student1@campus.edu.in','CampusStudent!2026');
const db=new DatabaseSync(resolve(root,'.presentation/sql-activity.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=3000;
 CREATE TABLE IF NOT EXISTS captured_sql_activity (
 request_id TEXT NOT NULL,event_id INTEGER NOT NULL,timestamp TEXT,method TEXT,path TEXT,role TEXT,
 sql_template TEXT,duration_ms REAL,rows_reported INTEGER,request_success INTEGER,
 PRIMARY KEY(request_id,event_id));
 CREATE VIEW IF NOT EXISTS recent_operations AS SELECT timestamp,method,path,role,request_success,duration_ms,rows_reported,sql_template,request_id
 FROM captured_sql_activity ORDER BY timestamp DESC,event_id DESC;`);
const insert=db.prepare(`INSERT INTO captured_sql_activity VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_id,event_id) DO UPDATE SET request_success=excluded.request_success`);
async function capture(){
 const result=await admin.evaluate(async()=>{const r=await fetch('/api/dbviewer');return {status:r.status,body:await r.json()};});
 if(result.status!==200)throw new Error(`Audit fetch failed: ${result.status}`);
 db.exec('BEGIN');try{for(const e of result.body.items)insert.run(e.request_id,e.id,e.timestamp,e.method,e.path,e.role,e.sql,e.duration_ms,e.rows,e.success===null?null:Number(e.success));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
}
await capture();console.log('Admin Helium + student Chromium signed in. Capturing redacted activity to .presentation/sql-activity.sqlite every second.');
let busy=false;const timer=setInterval(async()=>{if(busy)return;busy=true;try{await capture();}catch(e){console.error(e.message);}finally{busy=false;}},1000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);db.close();browsers.forEach(b=>b.disconnect());process.exit(0);});
