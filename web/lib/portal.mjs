import { createHash, randomBytes, randomUUID, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import * as api from './api.mjs';
import { withSqlAudit, getSqlAudit } from './sql-audit.mjs';

const derive = promisify(scrypt);
const initialized = new WeakSet();
const cookieName = 'campus_session';
const sessionLifetime = 8 * 60 * 60 * 1000;
const fail = (status, detail) => { throw Object.assign(new Error(detail), { status }); };
const hash = value => createHash('sha256').update(value).digest('hex');
const passwordValid = value => typeof value === 'string' && value.length >= 12 && value.length <= 256;
const idValue = value => {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) fail(422, 'A positive integer ID is required');
  return Number(value);
};
const accountView = a => ({ account_id: a.account_id, email: a.email, role: a.role, student_id: a.student_id });
const cookie = (value, maxAge) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

export function initializePortal(db) {
  if (initialized.has(db)) return;
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS portal_account (
      account_id INTEGER PRIMARY KEY, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      role TEXT NOT NULL CHECK(role IN ('admin','student')),
      student_id INTEGER UNIQUE REFERENCES student(student_id) ON DELETE RESTRICT,
      password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
      CHECK ((role='admin' AND student_id IS NULL) OR (role='student' AND student_id IS NOT NULL))
    );
    CREATE TABLE IF NOT EXISTS portal_session (
      token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES portal_account(account_id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_throttle (key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attendance (
      attendance_id INTEGER PRIMARY KEY, enrollment_id INTEGER NOT NULL REFERENCES enrollment(enrollment_id) ON DELETE RESTRICT,
      date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('Present','Absent','Late','Excused')),
      UNIQUE(enrollment_id,date)
    );
    CREATE TABLE IF NOT EXISTS library_book (
      book_id INTEGER PRIMARY KEY, isbn TEXT NOT NULL UNIQUE, title TEXT NOT NULL, author TEXT NOT NULL,
      copies INTEGER NOT NULL CHECK(copies > 0)
    );
    CREATE TABLE IF NOT EXISTS library_loan (
      loan_id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
      book_id INTEGER NOT NULL REFERENCES library_book(book_id) ON DELETE RESTRICT,
      borrowed_date TEXT NOT NULL, due_date TEXT NOT NULL, returned_date TEXT,
      CHECK(due_date >= borrowed_date), CHECK(returned_date IS NULL OR returned_date >= borrowed_date)
    );
    CREATE INDEX IF NOT EXISTS idx_portal_session_expiry ON portal_session(expires_at);
    CREATE INDEX IF NOT EXISTS idx_library_loan_student ON library_loan(student_id);
  `);
  try {
    const seedAccount = (email, role, studentId, password) => {
      if (db.prepare('SELECT account_id FROM portal_account WHERE email=? OR student_id=?').get(email, studentId)) return;
      const salt = randomBytes(16).toString('hex');
      db.prepare('INSERT INTO portal_account(email,role,student_id,password_salt,password_hash) VALUES(?,?,?,?,?)')
        .run(email, role, studentId, salt, scryptSync(password, salt, 64).toString('hex'));
    };
    seedAccount('admin@campus.local', 'admin', null, 'CampusAdmin!2026');
    const student = db.prepare('SELECT email FROM student WHERE student_id=1').get();
    if (student) seedAccount(student.email, 'student', 1, 'CampusStudent!2026');
    // A durable marker prevents deleted demo loans from reappearing on restart.
    db.exec('CREATE TABLE IF NOT EXISTS portal_migration (name TEXT PRIMARY KEY)');
    if (!db.prepare('SELECT name FROM portal_migration WHERE name=?').get('demo-v1')) {
      for (const [isbn, title, author, copies] of [
        ['9780133970777', 'Fundamentals of Database Systems', 'Ramez Elmasri and Shamkant Navathe', 5],
        ['9780262046305', 'Introduction to Algorithms', 'Thomas H. Cormen et al.', 3],
        ['9780133594140', 'Computer Networks', 'Andrew S. Tanenbaum', 4],
      ]) db.prepare('INSERT OR IGNORE INTO library_book(isbn,title,author,copies) VALUES(?,?,?,?)').run(isbn, title, author, copies);
      const enrollments = db.prepare('SELECT enrollment_id FROM enrollment ORDER BY enrollment_id LIMIT 12').all();
      for (const [index, enrollment] of enrollments.entries()) {
        for (const date of ['2026-02-02', '2026-02-03', '2026-02-04']) {
          db.prepare('INSERT OR IGNORE INTO attendance(enrollment_id,date,status) VALUES(?,?,?)')
            .run(enrollment.enrollment_id, date, ['Present', 'Present', 'Late', 'Absent', 'Excused'][index % 5]);
        }
      }
      if (student) {
        const book = db.prepare('SELECT book_id FROM library_book WHERE isbn=?').get('9780133970777');
        db.prepare('INSERT INTO library_loan(student_id,book_id,borrowed_date,due_date,returned_date) VALUES(1,?,?,?,NULL)')
          .run(book.book_id, '2026-02-01', '2026-02-15');
      }
      db.prepare('INSERT INTO portal_migration(name) VALUES(?)').run('demo-v1');
    }
    db.exec('COMMIT');
    initialized.add(db);
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

const definitions = {
  attendance: { table: 'attendance', pk: 'attendance_id', fields: ['enrollment_id', 'date', 'status'] },
  'library-books': { table: 'library_book', pk: 'book_id', fields: ['isbn', 'title', 'author', 'copies'] },
  'library-loans': { table: 'library_loan', pk: 'loan_id', fields: ['student_id', 'book_id', 'borrowed_date', 'due_date', 'returned_date'] },
};
function objectBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(422, 'A JSON object is required');
  if (Object.keys(body).some(key => !allowed.includes(key))) fail(422, 'Unknown field');
}
function validate(def, body, old) {
  objectBody(body, def.fields);
  if (!Object.keys(body).length) fail(422, 'No fields supplied');
  const data = Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  const merged = { ...old, ...data };
  for (const field of def.fields) {
    const value = merged[field];
    if (field === 'returned_date' && value == null) continue;
    if (value == null || value === '') fail(422, `${field} is required`);
    if (field.endsWith('_id') || field === 'copies') {
      const parsed = idValue(value);
      if (field === 'copies' && parsed > 100000) fail(422, 'copies must be at most 100000');
      if (Object.hasOwn(data, field)) data[field] = parsed;
    } else if (field === 'date' || field.endsWith('_date')) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(422, `${field} must be a valid YYYY-MM-DD date`);
    } else if (typeof value !== 'string' || value.length > (field === 'isbn' ? 32 : 300)) fail(422, `${field} must be valid text`);
  }
  if (def.table === 'attendance' && !['Present', 'Absent', 'Late', 'Excused'].includes(merged.status)) fail(422, 'Invalid attendance status');
  if (def.table === 'library_loan' && (merged.due_date < merged.borrowed_date || (merged.returned_date != null && merged.returned_date < merged.borrowed_date))) fail(422, 'Loan dates must follow the borrowed date');
  return data;
}
function crud(db, def, method, segment, url, body) {
  const id = segment == null ? null : idValue(segment);
  const one = () => db.prepare(`SELECT * FROM ${def.table} WHERE ${def.pk}=?`).get(id);
  if (method === 'GET') {
    if (id) { const row = one(); if (!row) fail(404, 'Record not found'); return { status: 200, body: row }; }
    const page = idValue(url.searchParams.get('page') ?? 1);
    const size = idValue(url.searchParams.get('page_size') ?? 20);
    if (size > 200) fail(422, 'page_size must be at most 200');
    const total = db.prepare(`SELECT count(*) n FROM ${def.table}`).get().n;
    return { status: 200, body: { items: db.prepare(`SELECT * FROM ${def.table} ORDER BY ${def.pk} DESC LIMIT ? OFFSET ?`).all(size, (page - 1) * size), total, page, page_size: size, pages: Math.ceil(total / size) } };
  }
  if (!(method === 'POST' && !id || ['PUT', 'DELETE'].includes(method) && id)) fail(405, 'Method not allowed');
  const old = id ? one() : null;
  if (id && !old) fail(404, 'Record not found');
  if (method === 'DELETE') {
    db.prepare(`DELETE FROM ${def.table} WHERE ${def.pk}=?`).run(id);
    return { status: 200, body: { detail: 'Record deleted' } };
  }
  const data = validate(def, body, old), fields = Object.keys(data);
  let resultId = id;
  if (id) db.prepare(`UPDATE ${def.table} SET ${fields.map(f => `${f}=?`).join(',')} WHERE ${def.pk}=?`).run(...Object.values(data), id);
  else resultId = Number(db.prepare(`INSERT INTO ${def.table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(data)).lastInsertRowid);
  return { status: id ? 200 : 201, body: db.prepare(`SELECT * FROM ${def.table} WHERE ${def.pk}=?`).get(resultId) };
}

async function dispatchPortal(service, request, url, path, account, tokenHash) {
  const { db } = service, method = request.method.toUpperCase();
  let body;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const text = await request.text();
    if (text.length > 65536) fail(413, 'Request body is too large');
    if (!text && path === '/auth/logout') body = {};
    else { try { body = JSON.parse(text); } catch { fail(400, 'Request body must be valid JSON'); } }
  }
  if (path === '/auth/login' && method === 'POST') {
    objectBody(body, ['email', 'password']);
    if (typeof body.email !== 'string' || body.email.length > 150 || typeof body.password !== 'string' || body.password.length > 256) fail(422, 'Email and password are required');
    const email = body.email.trim().toLowerCase(), now = Date.now(), key = hash(email);
    db.prepare('DELETE FROM login_throttle WHERE reset_at<=?').run(now);
    const throttle = db.prepare('SELECT attempts FROM login_throttle WHERE key_hash=?').get(key);
    if (throttle?.attempts >= 5) return { status: 429, headers: { 'Retry-After': '900' }, body: { detail: 'Too many login attempts; retry later' } };
    // Count before awaiting scrypt, so simultaneous failures cannot bypass the limit.
    db.prepare('INSERT INTO login_throttle(key_hash,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=attempts+1').run(key, now + 15 * 60 * 1000);
    const found = db.prepare('SELECT * FROM portal_account WHERE email=?').get(email);
    const calculated = await derive(body.password, found?.password_salt ?? 'invalid-account-salt', 64);
    const expected = found ? Buffer.from(found.password_hash, 'hex') : Buffer.alloc(64);
    if (!found || expected.length !== calculated.length || !timingSafeEqual(expected, calculated)) fail(401, 'Invalid email or password');
    db.prepare('DELETE FROM login_throttle WHERE key_hash=?').run(key);
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM portal_session WHERE expires_at<=?').run(now);
    db.prepare('INSERT INTO portal_session(token_hash,account_id,expires_at) VALUES(?,?,?)').run(hash(token), found.account_id, now + sessionLifetime);
    return { status: 200, headers: { 'Set-Cookie': cookie(token, sessionLifetime / 1000) }, body: accountView(found) };
  }
  if (path === '/auth/me' && method === 'GET') return { status: 200, body: accountView(account) };
  if (path === '/auth/logout' && method === 'POST') {
    db.prepare('DELETE FROM portal_session WHERE token_hash=?').run(tokenHash);
    return { status: 200, headers: { 'Set-Cookie': cookie('', 0) }, body: { detail: 'Logged out' } };
  }
  if (path.startsWith('/portal/')) {
    if (method !== 'GET') fail(405, 'Method not allowed');
    if (!account.student_id) fail(403, 'A linked student account is required');
    const sid = account.student_id;
    if (path === '/portal/me') return { status: 200, body: db.prepare('SELECT s.*, d.department_name, d.department_code FROM student s LEFT JOIN department d USING(department_id) WHERE student_id=?').get(sid) };
    if (path === '/portal/courses') return { status: 200, body: db.prepare(`SELECT e.*, c.course_code,c.course_name,c.credits,o.section,sem.semester_name,sem.academic_year,
      g.marks_obtained,g.max_marks,g.grade_letter FROM enrollment e JOIN course_offering o USING(offering_id)
      JOIN course c USING(course_id) JOIN semester sem USING(semester_id) LEFT JOIN grade g USING(enrollment_id)
      WHERE e.student_id=? ORDER BY e.enrollment_id`).all(sid) };
    if (path === '/portal/attendance') return { status: 200, body: db.prepare(`SELECT a.*,c.course_code,c.course_name FROM attendance a JOIN enrollment e USING(enrollment_id)
      JOIN course_offering o USING(offering_id) JOIN course c USING(course_id) WHERE e.student_id=? ORDER BY a.date DESC,a.attendance_id DESC`).all(sid) };
    if (path === '/portal/library') return { status: 200, body: db.prepare(`SELECT l.*, b.isbn,b.title,b.author FROM library_loan l JOIN library_book b USING(book_id) WHERE l.student_id=? ORDER BY l.loan_id DESC`).all(sid) };
    fail(404, 'Endpoint not found');
  }
  if (path === '/dbviewer' && method === 'GET') return { status: 200, body: { items: getSqlAudit(), limit: 200 } };
  if (path === '/admin/accounts' && method === 'POST') {
    objectBody(body, ['student_id', 'password']);
    const sid = idValue(body.student_id);
    if (!passwordValid(body.password)) fail(422, 'Password must contain 12–256 characters');
    const student = db.prepare('SELECT email FROM student WHERE student_id=?').get(sid);
    if (!student) fail(409, 'Student does not exist');
    const salt = randomBytes(16).toString('hex'), derived = await derive(body.password, salt, 64);
    const result = db.prepare("INSERT INTO portal_account(email,role,student_id,password_salt,password_hash) VALUES(?,'student',?,?,?)").run(student.email, sid, salt, derived.toString('hex'));
    return { status: 201, body: { account_id: Number(result.lastInsertRowid), email: student.email, role: 'student', student_id: sid } };
  }
  const parts = path.slice(1).split('/');
  // Both canonical resource paths and /admin/resource aliases are accepted.
  if (parts[0] === 'admin') parts.shift();
  if (Object.hasOwn(definitions, parts[0])) {
    if (parts.length > 2) fail(404, 'Endpoint not found');
    const result=crud(db, definitions[parts[0]], method, parts[1], url, body);
    if (method!=='GET') service.refreshSnapshot?.();
    return result;
  }
  return service.dispatch(method, request.url, body);
}

function safeError(error) {
  if (error.status) return { status: error.status, body: { detail: error.message } };
  const message = String(error.message);
  if (/UNIQUE constraint/i.test(message)) return { status: 409, body: { detail: 'A record with these values already exists' } };
  if (/FOREIGN KEY/i.test(message)) return { status: 409, body: { detail: 'Related record is missing or has dependent records' } };
  if (/CHECK constraint|NOT NULL/i.test(message)) return { status: 422, body: { detail: 'Invalid record values' } };
  if (/locked|busy/i.test(message)) return { status: 503, body: { detail: 'Database is busy; retry later' } };
  return { status: 500, body: { detail: 'Unable to complete request' } };
}

/** Request -> Response; inject a service for isolated tests, otherwise use api.getService(). */
export async function handle(request, service) {
  let result;
  try {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) fail(404, 'Endpoint not found');
    const path = url.pathname.slice(4).replace(/\/$/, '') || '/';
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const origin = request.headers.get('origin');
      // Non-browser clients may omit Origin; foreign and opaque origins are rejected.
      const forwardedHost = request.headers.get('host');
      const expectedOrigin = forwardedHost ? `${url.protocol}//${forwardedHost}` : url.origin;
      if (origin && origin !== expectedOrigin) fail(403, 'Cross-origin mutation is not allowed');
      if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Cross-site mutation is not allowed');
    }
    service ??= api.getService();
    initializePortal(service.db);
    const token = request.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const tokenHash = token && /^[a-f0-9]{64}$/.test(token) ? hash(token) : '';
    const account = tokenHash ? service.db.prepare(`SELECT a.account_id,a.email,a.role,a.student_id FROM portal_session s
      JOIN portal_account a USING(account_id) WHERE s.token_hash=? AND s.expires_at>?`).get(tokenHash, Date.now()) : null;
    const publicRoute = method === 'GET' && path === '/health' || method === 'POST' && path === '/auth/login';
    if (!publicRoute && !account) fail(401, 'Authentication required');
    const studentAllowed = method === 'GET' && ['/portal/me', '/portal/courses', '/portal/attendance', '/portal/library', '/auth/me'].includes(path)
      || method === 'POST' && path === '/auth/logout';
    if (!publicRoute && account.role !== 'admin' && !studentAllowed) fail(403, 'Administrator access required');
    result = await withSqlAudit({ request_id: randomUUID(), method, path: `/api${path}`, role: account?.role ?? 'anonymous', account_id: account?.account_id, student_id: account?.student_id },
      async () => { try { return await dispatchPortal(service, request, url, path, account, tokenHash); } catch (error) { return safeError(error); } });
  } catch (error) { result = safeError(error); }
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...result.headers };
  if (headers['Content-Type']?.startsWith('text/csv') || headers['Content-Type']?.startsWith('application/sql')) return new Response(result.body, { status: result.status, headers });
  return Response.json(result.body, { status: result.status, headers });
}
