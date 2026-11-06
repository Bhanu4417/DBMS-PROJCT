import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createService } from '../lib/api.mjs';
import { handle, initializePortal } from '../lib/portal.mjs';
import { withSqlAudit, recordSql, getSqlAudit } from '../lib/sql-audit.mjs';

const directory = mkdtempSync(resolve(import.meta.dirname, 'portal-test-'));
const filename = resolve(directory, 'test.sqlite');
const service = createService({ filename });
after(() => { service.close(); rmSync(directory, { recursive: true, force: true }); });
async function call(method, path, body, cookie, extra = {}, target = service) {
  const headers = { ...extra };
  if (cookie) headers.cookie = cookie;
  const request = new Request(`http://localhost/api/${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const response = await handle(request, target);
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, body: data, headers: response.headers, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function login(email, password) {
  const response = await call('POST', 'auth/login', { email, password });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response;
}
let admin, student;

test('public health, auth, strict cookies, hashes and authorization for every original route', async () => {
  assert.equal((await call('GET', 'health')).status, 200);
  assert.equal(service.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name LIKE 'library_%'").get().n, 0);
  assert.equal((await call('GET', 'students')).status, 401);
  admin = await login('admin@campus.local', 'CampusAdmin!2026');
  student = await login('student1@campus.edu.in', 'CampusStudent!2026');
  assert.match(student.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal(student.body.student_id, 1);
  const stored = service.db.prepare('SELECT * FROM portal_account WHERE role=?').get('student');
  assert.notEqual(stored.password_hash, 'CampusStudent!2026');
  assert.equal(stored.password_hash.length, 128);
  assert.ok(!JSON.stringify(student.body).includes('password'));
  const sessions = service.db.prepare('SELECT token_hash FROM portal_session').all();
  assert.ok(sessions.every(s => !student.cookie.includes(s.token_hash)));
  for (const path of ['students', 'students/1', 'students/options', 'enrollments/options', 'dashboard/stats', 'reports', 'database/export.sql', 'attendance', 'admin/accounts', 'dbviewer', 'nonexistent']) {
    assert.equal((await call('GET', path, undefined, student.cookie)).status, 403, path);
  }
  assert.equal((await call('GET', 'students', undefined, admin.cookie)).status, 200);
  assert.equal((await call('GET', 'enrollments/options', undefined, admin.cookie)).status, 200);
  assert.equal((await call('POST', 'auth/login', { email: 'admin@campus.local', password: 'CampusAdmin!2026' }, undefined, { origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await call('POST', 'auth/logout', {}, student.cookie, { origin: 'null' })).status, 403);
  assert.equal((await call('POST', 'auth/logout', {}, student.cookie, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await call('GET', 'auth/me', undefined, student.cookie)).status, 200);
  assert.equal((await call('GET', 'library-books', undefined, admin.cookie)).status, 404);
  assert.equal((await call('GET', 'library-loans', undefined, admin.cookie)).status, 404);
  assert.equal(service.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name LIKE 'library_%'").get().n, 0);
});

test('student self endpoints ignore client IDs and only expose linked rows', async () => {
  for (const path of ['portal/me', 'portal/courses', 'portal/attendance']) {
    const result = await call('GET', `${path}?student_id=2&enrollment_id=2`, undefined, student.cookie);
    assert.equal(result.status, 200);
    if (path === 'portal/me') assert.equal(result.body.student_id, 1);
    else {
      assert.ok(Array.isArray(result.body));
      assert.ok(result.body.length > 0);
      for (const row of result.body) {
        if (row.student_id !== undefined) assert.equal(row.student_id, 1);
        if (row.enrollment_id !== undefined) assert.equal(service.db.prepare('SELECT student_id FROM enrollment WHERE enrollment_id=?').get(row.enrollment_id).student_id, 1);
      }
    }
    assert.equal((await call('POST', path, {}, student.cookie)).status, 403);
  }
});

test('attendance CRUD validation, pagination, and safe SQL export', async () => {
  const attendance = await call('POST', 'attendance', { enrollment_id: 1, date: '2026-03-10', status: 'Present' }, admin.cookie);
  assert.equal(attendance.status, 201);
  const aid = attendance.body.attendance_id;
  assert.equal((await call('POST', 'attendance', { enrollment_id: 1, date: '2026-03-10', status: 'Absent' }, admin.cookie)).status, 409);
  for (const patch of [{ date: '2026-02-30' }, { status: 'bad' }, { enrollment_id: 99999 }, { unexpected: true }]) {
    const response = await call('PUT', `attendance/${aid}`, patch, admin.cookie);
    assert.equal(response.status, patch.enrollment_id ? 409 : 422);
    assert.ok(!JSON.stringify(response.body).includes('SQLITE'));
  }
  assert.equal((await call('PUT', `attendance/${aid}`, { status: 'Excused' }, admin.cookie)).body.status, 'Excused');
  assert.equal((await call('GET', 'attendance?page_size=201', undefined, admin.cookie)).status, 422);
  assert.equal((await call('GET', 'attendance', undefined, admin.cookie)).body.page_size, 20);
  const snapshot = await call('GET', 'database/export.sql', undefined, admin.cookie);
  assert.equal(snapshot.status, 200);
  assert.match(snapshot.headers.get('content-type'), /application\/sql/);
  assert.match(snapshot.body, /CREATE TABLE student/);
  assert.ok(!snapshot.body.includes('CampusAdmin!2026'));
  assert.ok(!snapshot.body.includes(service.db.prepare('SELECT password_hash FROM portal_account LIMIT 1').get().password_hash));
});

test('admin provisions only student accounts with database email; sessions persist and logout revokes', async () => {
  assert.equal((await call('POST', 'admin/accounts', { student_id: 2, password: 'AnotherStudent!2026', role: 'admin' }, admin.cookie)).status, 422);
  assert.equal((await call('POST', 'admin/accounts', { student_id: 99999, password: 'AnotherStudent!2026' }, admin.cookie)).status, 409);
  assert.equal((await call('POST', 'admin/accounts', { student_id: 2, password: 'short' }, admin.cookie)).status, 422);
  const provisioned = await call('POST', 'admin/accounts', { student_id: 2, password: 'AnotherStudent!2026' }, admin.cookie);
  assert.equal(provisioned.status, 201);
  assert.equal(provisioned.body.email, 'student2@campus.edu.in');
  assert.equal(provisioned.body.role, 'student');
  assert.equal((await call('POST', 'admin/accounts', { student_id: 2, password: 'AnotherStudent!2026' }, admin.cookie)).status, 409);
  const secondStudent = await login('student2@campus.edu.in', 'AnotherStudent!2026');
  const reopened = createService({ filename });
  try {
    const before = service.db.prepare('SELECT count(*) n FROM attendance').get().n;
    initializePortal(reopened.db);
    assert.equal(reopened.db.prepare('SELECT count(*) n FROM attendance').get().n, before);
    assert.equal((await call('GET', 'auth/me', undefined, secondStudent.cookie, {}, reopened)).body.student_id, 2);
  } finally { reopened.close(); }
  assert.equal((await call('POST', 'auth/logout', undefined, secondStudent.cookie, { origin: 'http://localhost' })).status, 200);
  assert.equal((await call('GET', 'auth/me', undefined, secondStudent.cookie)).status, 401);
  const expired = await login('student2@campus.edu.in', 'AnotherStudent!2026');
  service.db.prepare('UPDATE portal_session SET expires_at=0 WHERE account_id=?').run(provisioned.body.account_id);
  assert.equal((await call('GET', 'portal/me', undefined, expired.cookie)).status, 401);
});

test('optional Person ISA layer is admin-only, allows partial/overlapping roles, and uses owner-relative contact keys', async () => {
  assert.equal((await call('GET','eer/people',undefined,student.cookie)).status,403);
  const empty=await call('POST','eer/people',{},admin.cookie);
  assert.equal(empty.status,201);
  const emptyId=empty.body.person_id;
  assert.equal(empty.body.student_id,null); assert.equal(empty.body.faculty_id,null);
  const partial=await call('POST',`eer/people/${emptyId}/roles`,{student_id:1},admin.cookie);
  assert.equal(partial.status,200); assert.equal(partial.body.student_id,1); assert.equal(partial.body.faculty_id,null);
  const role=await call('POST',`eer/people/${emptyId}/roles`,{faculty_id:1},admin.cookie);
  assert.equal(role.status,200); assert.equal(role.body.student_id,1); assert.equal(role.body.faculty_id,1);
  const second=await call('POST','eer/people',{student_id:2},admin.cookie);
  assert.equal(second.status,201); assert.equal(second.body.faculty_id,null);
  assert.equal((await call('POST','eer/people',{student_id:1},admin.cookie)).status,409);
  assert.equal((await call('POST',`eer/people/${emptyId}/contacts`,{contact_type:'phone',contact_value:'  +1 555 123  '},admin.cookie)).status,201);
  assert.equal((await call('POST',`eer/people/${emptyId}/contacts`,{contact_type:'phone',contact_value:'+1 555 123'},admin.cookie)).status,409);
  assert.equal((await call('POST',`eer/people/${second.body.person_id}/contacts`,{contact_type:'phone',contact_value:'+1 555 123'},admin.cookie)).status,201);
  assert.equal((await call('POST',`eer/people/${emptyId}/contacts`,{contact_type:'fax',contact_value:'123'},admin.cookie)).status,422);
  assert.equal((await call('GET',`eer/people/${emptyId}/contacts`,undefined,admin.cookie)).body.length,1);
  const list=await call('GET','eer/people',undefined,admin.cookie);
  assert.equal(list.body.total,2);
  const snapshot=await call('GET','database/export.sql',undefined,admin.cookie);
  assert.match(snapshot.body,/CREATE TABLE campus_person/);
  assert.match(snapshot.body,/CREATE TABLE person_contact/);
  assert.match(snapshot.body,/CREATE VIEW v_person_eer/);
});

test('login throttling stores only hashed identifiers and generic errors', async () => {
  for (let i = 0; i < 5; i++) {
    const result = await call('POST', 'auth/login', { email: 'nobody@campus.local', password: 'wrong' });
    assert.equal(result.status, 401);
    assert.equal(result.body.detail, 'Invalid email or password');
  }
  const blocked = await call('POST', 'auth/login', { email: 'nobody@campus.local', password: 'wrong' });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '900');
  const record = service.db.prepare('SELECT * FROM login_throttle').get();
  assert.match(record.key_hash, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(record).includes('nobody'));
  service.db.prepare('UPDATE login_throttle SET reset_at=0').run();
  assert.equal((await call('POST', 'auth/login', { email: 'nobody@campus.local', password: 'wrong' })).status, 401);
  const invalid = new Request('http://localhost/api/auth/login', { method: 'POST', body: '{' });
  assert.equal((await handle(invalid, service)).status, 400);
});

test('audit bounded templates exclude authentication, isolate parallel contexts, and carry request success', async () => {
  await Promise.all(['admin', 'student'].map(role => withSqlAudit({ request_id: role, role, method: 'GET', path: '/api/test' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 1));
    recordSql("SELECT * FROM student WHERE email='secret@invalid' AND student_id=123", 1.5, 1);
    recordSql('SELECT * FROM portal_account', 1, 1);
    recordSql('INSERT INTO portal_session VALUES(?)', 1, 1);
    return { status: role === 'admin' ? 200 : 403 };
  })));
  const recent = getSqlAudit().slice(-2);
  assert.equal(recent.length, 2);
  assert.equal(recent.find(e => e.role === 'student').success, false);
  assert.equal(recent.find(e => e.role === 'admin').success, true);
  assert.ok(recent.every(e => !e.sql.includes('secret@invalid') && !e.sql.includes('123')));
  await withSqlAudit({ role: 'admin', method: 'GET', path: '/api/test' }, () => {
    for (let i = 0; i < 210; i++) recordSql('SELECT ? FROM student', 0, 0);
    return { status: 200 };
  });
  assert.equal(getSqlAudit().length, 200);
  const viewer = await call('GET', 'dbviewer', undefined, admin.cookie);
  assert.equal(viewer.status, 200);
  assert.equal(viewer.body.limit, 200);
  assert.equal(viewer.body.items.length, 200);
});
