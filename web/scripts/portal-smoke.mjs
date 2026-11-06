import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage();await page.setViewport({width:1440,height:1000});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const text=async(value)=>page.waitForFunction(v=>document.body.innerText.includes(v),{},value);
async function login(email,password){await page.goto('http://localhost:3000/');await page.waitForSelector('input[type=email]');await page.type('input[type=email]',email);await page.type('input[type=password]',password);await page.click('button[type=submit],form button.btn-primary');}
try {
 await login('admin@campus.local','CampusAdmin!2026');await text('Overview');
 for(const route of ['students','courses','semesters','attendance','eer','accounts','dbviewer']){await page.goto('http://localhost:3000/'+route);await page.waitForSelector('h1');await new Promise(r=>setTimeout(r,700));assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Unable to complete request'),route);console.log('PASS admin',route);}
 await page.screenshot({path:'../.screens/admin-portal.png',fullPage:true});
 await page.evaluate(()=>fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));
 await login('student1@campus.edu.in','CampusStudent!2026');await text('student portal');await text('My courses');
 for(const tab of ['My courses','Attendance']){await page.evaluate(t=>[...document.querySelectorAll('[role=tab]')].find(x=>x.textContent===t).click(),tab);await new Promise(r=>setTimeout(r,200));console.log('PASS student',tab);}
 const forbidden=await page.evaluate(async()=>({read:(await fetch('/api/students')).status,write:(await fetch('/api/students',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status}));assert.deepEqual(forbidden,{read:403,write:403});
 await page.screenshot({path:'../.screens/student-portal.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS student authorization and no runtime errors');
} finally{await browser.close();}
