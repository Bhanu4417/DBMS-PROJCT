import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, CalendarCheck, Library } from 'lucide-react';
import api, { errorMessage } from '../services/api';

const tabs = ['Overview', 'My courses', 'Attendance', 'Library'];
const date = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function Portal({ user }) {
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    Promise.all(['me', 'courses', 'attendance', 'library'].map((name) => api.get(`/portal/${name}`, { signal: controller.signal })))
      .then(([profile, courses, attendance, library]) => { if (active) setData({ profile: profile.data, courses: courses.data, attendance: attendance.data, library: library.data }); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt, user?.account_id]);

  const present = data?.attendance.filter((row) => row.status === 'Present').length || 0;
  const rate = data?.attendance.length ? `${Math.round(present / data.attendance.length * 100)}%` : '—';
  const loans = data?.library.filter((row) => !row.returned_date) || [];
  const credits = data?.courses.reduce((sum, row) => sum + (Number(row.credits) || 0), 0) || 0;
  const nextDue = [...loans].filter((row) => row.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  return (
    <div className="space-y-6">
      <header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Student portal</p><h1 className="text-2xl font-semibold text-ink">{data ? `Welcome, ${data.profile.full_name || 'student'}` : 'Your academic overview'}</h1><p className="mt-2 text-sm text-muted">Your academic records, all in one place. Read-only access.</p></header>
      <div className="flex gap-2 overflow-x-auto border-b border-line pb-3" role="tablist" aria-label="Student records">{tabs.map((name) => <button key={name} id={`tab-${name.replaceAll(' ', '-')}`} type="button" role="tab" aria-selected={tab === name} aria-controls="portal-panel" className={`${tab === name ? 'btn-primary' : 'btn-ghost'} shrink-0 text-sm`} onClick={() => setTab(name)}>{name}</button>)}</div>
      {loading ? <div role="status" className="card p-8 text-sm text-muted">Loading your campus records…</div> : error ? <div role="alert" className="card space-y-3 p-6"><p className="text-danger">{error}</p><button className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Retry</button></div> : data && (
        <section id="portal-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(' ', '-')}`} className="space-y-5">
          {tab === 'Overview' && <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[['Enrolled courses', data.courses.length, BookOpen], ['Total credits', credits, GraduationCap], ['Attendance', rate, CalendarCheck], ['Active loans', loans.length, Library]].map(([label, value, Icon]) => <div key={label} className="card p-5"><Icon size={20} className="mb-4 text-accent" /><p className="text-3xl font-semibold text-ink">{value}</p><p className="mt-1 text-sm text-muted">{label}</p></div>)}
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="card p-6"><h2 className="mb-5 font-semibold text-ink">Student profile</h2><dl className="space-y-4">{[['Full name', data.profile.full_name], ['Enrollment number', data.profile.enrollment_number], ['Email', data.profile.email || user?.email], ['Department', data.profile.department_name], ['Department code', data.profile.department_code]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-muted">{label}</dt><dd className="break-all text-ink">{value || '—'}</dd></div>)}</dl></div>
              <div className="card p-6"><h2 className="mb-4 font-semibold text-ink">Library at a glance</h2><p className="text-sm text-muted">{loans.length ? `${loans.length} book${loans.length === 1 ? '' : 's'} currently on loan.` : 'No books currently on loan.'}</p>{nextDue && <div className="mt-5 rounded-lg border border-line bg-soft p-4"><p className="text-xs uppercase tracking-wide text-muted">Next due date</p><p className="mt-2 text-lg font-semibold text-ink">{date(nextDue.due_date)}</p><p className="mt-1 text-sm text-muted">{nextDue.title}</p></div>}<p className="mt-5 text-xs text-muted">Attendance percentage is based on records marked Present out of all attendance records.</p></div>
            </div>
          </>}
          {tab === 'My courses' && <Records headings={['Course', 'Semester', 'Section', 'Credits', 'Grade', 'Marks']} rows={data.courses.map((row, i) => ({ key: row.enrollment_id ?? i, cells: [<div><p className="font-medium">{row.course_name}</p><p className="text-xs text-muted">{row.course_code}</p></div>, `${row.semester_name || '—'} · ${row.academic_year || '—'}`, row.section, row.credits, row.grade_letter, row.marks_obtained == null ? '—' : `${row.marks_obtained} / ${row.max_marks ?? '—'}`] }))} empty="No course enrollments yet." />}
          {tab === 'Attendance' && <><p className="text-sm text-muted">Overall attendance: <span className="font-semibold text-ink">{rate}</span> · {present} present / {data.attendance.length} records</p><Records headings={['Date', 'Course', 'Status']} rows={data.attendance.map((row) => ({ key: row.attendance_id, cells: [date(row.date), `${row.course_code} — ${row.course_name}`, <span className={row.status === 'Present' ? 'text-accent' : 'text-ink'}>{row.status}</span>] }))} empty="No attendance records yet." /></>}
          {tab === 'Library' && <Records headings={['Book', 'Borrowed', 'Due', 'Returned', 'Status']} rows={data.library.map((row) => ({ key: row.loan_id, cells: [<div><p className="font-medium">{row.title}</p><p className="text-xs text-muted">{row.author} · {row.isbn}</p></div>, date(row.borrowed_date), date(row.due_date), date(row.returned_date), row.returned_date ? 'Returned' : row.due_date && new Date(`${row.due_date}T23:59:59`) < new Date() ? <span className="text-danger">Overdue</span> : 'On loan'] }))} empty="No library loans yet." />}
        </section>
      )}
    </div>
  );
}

function Records({ headings, rows, empty }) {
  if (!rows.length) return <div className="card p-8 text-sm text-muted">{empty}</div>;
  return <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-soft text-xs text-muted"><tr>{headings.map((heading) => <th key={heading} className="whitespace-nowrap px-5 py-3 font-medium" scope="col">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line">{rows.map((row) => <tr key={row.key}>{row.cells.map((cell, i) => <td key={i} className="px-5 py-4 text-ink">{cell ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
