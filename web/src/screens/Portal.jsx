import { useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Award, BookOpen, CalendarCheck, GraduationCap,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { CardSkeleton } from '../components/Skeleton';
import api, { errorMessage } from '../services/api';

// Charts are computed in the browser from the same four portal responses.
// Same honesty rules as before: Present/total attendance, credits include
// Dropped/Completed rows, overdue is a client-side date comparison, no fines.
const tabs = ['Overview', 'My courses', 'Attendance'];
const ATTENDANCE_COLORS = { Present: '#83D63B', Late: '#F59E0B', Excused: '#A1A1AA', Absent: '#EF4444' };
const date = (value) => value
  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  : '—';
const monthKey = (value) => String(value || '').slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 15).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};
const percent = (part, total) => (total ? Math.round((part / total) * 100) : null);

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
    Promise.all(['me', 'courses', 'attendance'].map((name) => api.get(`/portal/${name}`, { signal: controller.signal })))
      .then(([profile, courses, attendance]) => { if (active) setData({ profile: profile.data, courses: courses.data, attendance: attendance.data }); })
      .catch((err) => { if (active) setError(errorMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [attempt, user?.account_id]);

  if (loading || error || !data) {
    return (
      <div className="space-y-6">
        <header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Student portal</p><h1 className="text-2xl font-semibold text-ink">{data ? 'Your academic overview' : 'Loading…'}</h1><p className="mt-2 text-sm text-muted">Your academic records, all in one place. Read-only access.</p></header>
        {error ? <div role="alert" className="card space-y-3 p-6"><p className="text-danger">{error}</p><button className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Retry</button></div>
          : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={120} />)}</div>}
      </div>
    );
  }

  const { courses, attendance } = data;
  const byStatus = (status) => attendance.filter((row) => row.status === status).length;
  const present = byStatus('Present');
  const late = byStatus('Late');
  const excused = byStatus('Excused');
  const absent = byStatus('Absent');
  const rate = percent(present, attendance.length);
  const statuses = [
    { name: 'Present', value: present }, { name: 'Late', value: late },
    { name: 'Excused', value: excused }, { name: 'Absent', value: absent },
  ].filter((entry) => entry.value > 0);
  const perCourse = Object.values(attendance.reduce((acc, row) => {
    const key = row.course_code || '—';
    acc[key] ??= { code: key, name: row.course_name || '—', present: 0, total: 0 };
    acc[key].total += 1;
    if (row.status === 'Present') acc[key].present += 1;
    return acc;
  }, {})).map((row) => ({ ...row, pct: percent(row.present, row.total) }))
    .sort((a, b) => b.pct - a.pct || b.total - a.total);
  const monthly = Object.values(attendance.reduce((acc, row) => {
    const key = monthKey(row.date);
    acc[key] ??= { key, present: 0, total: 0 };
    acc[key].total += 1;
    if (row.status === 'Present') acc[key].present += 1;
    return acc;
  }, {})).map((row) => ({ month: monthLabel(row.key), pct: percent(row.present, row.total), present: row.present, total: row.total }))
    .sort((a, b) => a.key.localeCompare(b.key)).map(({ key, ...row }) => row);
  const semesterOrder = [];
  const creditsBySemester = Object.values(courses.reduce((acc, row) => {
    const key = `${row.semester_name || '—'} · ${row.academic_year || '—'}`;
    acc[key] ??= { name: key, credits: 0 };
    acc[key].credits += Number(row.credits) || 0;
    if (!semesterOrder.includes(key)) semesterOrder.push(key);
    return acc;
  }, {})).sort((a, b) => semesterOrder.indexOf(a.name) - semesterOrder.indexOf(b.name));
  const graded = courses.filter((row) => row.marks_obtained != null);
  const marksByCourse = graded.map((row) => ({
    code: row.course_code,
    pct: Math.round((Number(row.marks_obtained) / Number(row.max_marks)) * 100),
    marks: row.marks_obtained,
    max: row.max_marks,
    grade: row.grade_letter,
  }));
  const gradeMix = Object.entries(graded.reduce((acc, row) => {
    const key = row.grade_letter || 'Pending';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const credits = courses.reduce((sum, row) => sum + (Number(row.credits) || 0), 0);

  return (
    <div className="space-y-6">
      <header><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent">Student portal</p><h1 className="text-2xl font-semibold text-ink">{`Welcome, ${data.profile.full_name || 'student'}`}</h1><p className="mt-2 text-sm text-muted">Your academic records, charts and history, all in one place. Read-only access.</p></header>
      <div className="flex gap-2 overflow-x-auto border-b border-line pb-3" role="tablist" aria-label="Student records">{tabs.map((name) => <button key={name} id={`tab-${name.replaceAll(' ', '-')}`} type="button" role="tab" aria-selected={tab === name} aria-controls="portal-panel" className={`${tab === name ? 'btn-primary' : 'btn-ghost'} shrink-0 text-sm`} onClick={() => setTab(name)}>{name}</button>)}</div>
      <section id="portal-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(' ', '-')}`} className="space-y-5">
        {tab === 'Overview' && <OverviewTab user={user} data={data} credits={credits} rate={rate} present={present} graded={graded} statuses={statuses} perCourse={perCourse} creditsBySemester={creditsBySemester} marksByCourse={marksByCourse} />}
        {tab === 'My courses' && <CoursesTab courses={courses} marksByCourse={marksByCourse} gradeMix={gradeMix} credits={credits} />}
        {tab === 'Attendance' && <AttendanceTab attendance={attendance} rate={rate} present={present} late={late} excused={excused} absent={absent} statuses={statuses} perCourse={perCourse} monthly={monthly} />}
      </section>
    </div>
  );
}

function OverviewTab({ user, data, credits, rate, present, graded, statuses, perCourse, creditsBySemester, marksByCourse }) {
  const cards = [
    { label: 'Enrolled courses', value: data.courses.length, icon: BookOpen, tone: 'accent', hint: 'All enrollment records' },
    { label: 'Total credits', value: credits, icon: GraduationCap, tone: 'blue', hint: 'Includes Dropped/Completed rows' },
    { label: 'Attendance', value: rate ?? '—', icon: CalendarCheck, tone: 'success', hint: `${present} present records` },
    { label: 'Graded courses', value: graded.length, icon: Award, tone: 'success', hint: `${data.courses.length - graded.length} awaiting marks` },
  ];
  return <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <StatCard key={card.label} {...card} />)}</div>
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title="Attendance status split" subtitle="Every recorded session in your history">
        {statuses.length ? <Donut data={statuses} colors={ATTENDANCE_COLORS} /> : <NoChart message="No attendance records yet." />}
      </ChartCard>
      <ChartCard title="Marks by course" subtitle="Score percentage where marks exist">
        {marksByCourse.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={marksByCourse} barSize={28}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="code" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={54} /><YAxis tickLine={false} axisLine={false} width={32} domain={[0, 100]} /><Tooltip /><Bar dataKey="pct" name="Score %" radius={[6, 6, 0, 0]}>{marksByCourse.map((entry) => <Cell key={entry.code} fill={entry.pct >= 50 ? '#83D63B' : '#EF4444'} />)}</Bar></BarChart></ResponsiveContainer>
          : <NoChart message="Marks appear once grades are published." />}
      </ChartCard>

      <ChartCard title="Credits per semester" subtitle="Sum of enrollment credits (all statuses)">
        {creditsBySemester.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={creditsBySemester} layout="vertical" margin={{ left: 10 }}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={false} tickFormatter={(v) => v.length > 18 ? `${v.slice(0, 17)}…` : v} /><Tooltip /><Bar dataKey="credits" name="Credits" fill="#A1A1AA" barSize={14} radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer>
          : <NoChart message="No enrollments yet." />}
      </ChartCard>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-6"><h2 className="mb-5 font-semibold text-ink">Course attendance overview</h2>{perCourse.length ? <div className="space-y-3">{perCourse.map((row) => <div key={row.code} className="flex items-center gap-4 text-sm"><div className="min-w-0 flex-1"><p className="truncate font-medium text-ink">{row.name}</p><p className="text-xs text-muted">{row.code} · {row.present}/{row.total} present</p></div><div className="h-2.5 w-40 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.pct >= 75 ? '#83D63B' : row.pct >= 50 ? '#F59E0B' : '#EF4444' }} /></div><span className="w-12 text-right font-semibold text-ink">{row.pct}%</span></div>)}</div> : <p className="text-sm text-muted">No attendance records yet.</p>}</section>
      <div className="space-y-4">
        <section className="card p-6"><h2 className="mb-5 font-semibold text-ink">Student profile</h2><dl className="space-y-4">{[['Full name', data.profile.full_name], ['Enrollment number', data.profile.enrollment_number], ['Email', data.profile.email || user?.email], ['Department', data.profile.department_name], ['Department code', data.profile.department_code]].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 text-sm"><dt className="text-muted">{label}</dt><dd className="break-all text-ink">{value || '—'}</dd></div>)}</dl></section>
      </div>
    </div>
    <p className="text-xs text-muted">Attendance percentage is Present records ÷ all attendance records, rounded. Late and Excused are not counted as Present. Credits and course counts include Dropped and Completed enrollments.</p>
  </>;
}

function CoursesTab({ courses, marksByCourse, gradeMix, credits }) {
  const tabsOrder = courses;
  return <>
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title="Scores by course" subtitle="Marks obtained against maximum marks" className="xl:col-span-2">
        {marksByCourse.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={marksByCourse} barSize={34}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="code" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={58} /><YAxis tickLine={false} axisLine={false} width={32} domain={[0, 100]} /><Tooltip /><Bar dataKey="pct" name="Score %" radius={[6, 6, 0, 0]}>{marksByCourse.map((entry) => <Cell key={entry.code} fill={entry.pct >= 50 ? '#83D63B' : '#EF4444'} />)}</Bar></BarChart></ResponsiveContainer>
          : <NoChart message="Marks appear once grades are published." />}
      </ChartCard>
      <ChartCard title="Grade distribution" subtitle="Letters across graded courses">
        {gradeMix.length ? <Donut data={gradeMix} colors={Object.fromEntries(gradeMix.map((g, i) => [g.name, ['#83D63B', '#A1A1AA', '#F59E0B', '#EF4444', '#14B8A6', '#D4D4D8'][i % 6]]))} /> : <NoChart message="No graded courses yet." />}
      </ChartCard>
    </div>
    <section className="card overflow-x-auto">
      <h2 className="px-5 pt-5 font-semibold text-ink">All enrollments — {courses.length} records · {credits} credits (includes Dropped/Completed)</h2>
      {tabsOrder.length ? <table className="mt-4 w-full text-left text-sm"><thead className="border-b border-line bg-soft text-xs text-muted"><tr>{['Course', 'Semester', 'Section', 'Status', 'Enrolled', 'Credits', 'Grade', 'Marks'].map((heading) => <th key={heading} className="whitespace-nowrap px-5 py-3 font-medium" scope="col">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line">{tabsOrder.map((row) => <tr key={row.enrollment_id}><td className="px-5 py-4"><div><p className="font-medium text-ink">{row.course_name}</p><p className="text-xs text-muted">{row.course_code}</p></div></td><td className="whitespace-nowrap px-5 py-4 text-ink">{row.semester_name || '—'} · {row.academic_year || '—'}</td><td className="px-5 py-4 text-ink">{row.section}</td><td className="px-5 py-4"><Badge value={row.enrollment_status} /></td><td className="whitespace-nowrap px-5 py-4 text-ink">{date(row.enrollment_date)}</td><td className="px-5 py-4 text-ink">{row.credits}</td><td className="px-5 py-4 font-medium text-ink">{row.grade_letter || '—'}</td><td className="px-5 py-4 text-ink">{row.marks_obtained == null ? '—' : `${row.marks_obtained} / ${row.max_marks ?? '—'}${row.max_marks ? ` (${Math.round((row.marks_obtained / row.max_marks) * 100)}%)` : ''}`}</td></tr>)}</tbody></table>
        : <p className="p-8 text-sm text-muted">No course enrollments yet.</p>}
    </section>
  </>;
}

function AttendanceTab({ attendance, rate, present, late, excused, absent, statuses, perCourse, monthly }) {
  const cards = [
    { label: 'Overall attendance', value: rate ?? '—', icon: CalendarCheck, tone: 'accent', hint: `${attendance.length} records in total` },
    { label: 'Present', value: present, icon: CalendarCheck, tone: 'success', hint: 'Counted toward the rate' },
    { label: 'Late', value: late, icon: CalendarCheck, tone: 'warning', hint: 'Not counted as Present' },
    { label: 'Excused', value: excused, icon: CalendarCheck, tone: 'blue', hint: 'Not counted as Present' },
    { label: 'Absent', value: absent, icon: CalendarCheck, tone: 'danger', hint: 'Not counted as Present' },
  ];
  return <>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <StatCard key={card.label} {...card} />)}</div>
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartCard title="Status split" subtitle="All recorded sessions">
        {statuses.length ? <Donut data={statuses} colors={ATTENDANCE_COLORS} /> : <NoChart message="No attendance records yet." />}
      </ChartCard>
      <ChartCard title="Attendance per course" subtitle="Present share within each course" className="xl:col-span-2">
        {perCourse.length ? <ResponsiveContainer width="100%" height={250}><BarChart data={perCourse} barSize={30}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="code" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} /><Tooltip /><Bar dataKey="pct" name="Present %" radius={[6, 6, 0, 0]}>{perCourse.map((row) => <Cell key={row.code} fill={row.pct >= 75 ? '#83D63B' : row.pct >= 50 ? '#F59E0B' : '#EF4444'} />)}</Bar></BarChart></ResponsiveContainer>
          : <NoChart message="No attendance records yet." />}
      </ChartCard>
    </div>
    {monthly.length > 1 && <ChartCard title="Attendance trend by month" subtitle="Present percentage across each calendar month"><ResponsiveContainer width="100%" height={230}><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={32} /><Tooltip /><Line type="monotone" dataKey="pct" name="Present %" stroke="#83D63B" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, fill: 'rgb(var(--card))' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></ChartCard>}
    <section className="card overflow-x-auto">
      <h2 className="px-5 pt-5 font-semibold text-ink">Session history — latest first</h2>
      {attendance.length ? <table className="mt-4 w-full text-left text-sm"><thead className="border-b border-line bg-soft text-xs text-muted"><tr>{['Date', 'Course', 'Status'].map((heading) => <th key={heading} className="whitespace-nowrap px-5 py-3 font-medium" scope="col">{heading}</th>)}</tr></thead><tbody className="divide-y divide-line">{attendance.map((row) => <tr key={row.attendance_id}><td className="whitespace-nowrap px-5 py-4 text-ink">{date(row.date)}</td><td className="px-5 py-4 text-ink"><div><p className="font-medium">{row.course_code}</p><p className="text-xs text-muted">{row.course_name}</p></div></td><td className="px-5 py-4"><span className="font-medium" style={{ color: ATTENDANCE_COLORS[row.status] || 'rgb(var(--text))' }}>{row.status || '—'}</span></td></tr>)}</tbody></table>
        : <p className="p-8 text-sm text-muted">No attendance records yet.</p>}
    </section>
    <p className="text-xs text-muted">Rate = Present ÷ all records, rounded. Late, Excused and Absent are not counted as Present. Marks and attendance come from the same read-only portal queries.</p>
  </>;
}

function ChartCard({ title, subtitle, children, className = '' }) {
  return <section className={`card p-5 ${className}`}><div className="mb-4"><h3 className="text-sm font-semibold text-ink">{title}</h3><p className="text-xs text-muted">{subtitle}</p></div>{children}</section>;
}

function NoChart({ message }) {
  return <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center"><p className="text-sm font-medium text-ink">Nothing to chart yet</p><p className="text-xs text-muted">{message}</p></div>;
}

function Donut({ data, colors }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  return <>
    <span className="sr-only">{`Distribution of ${total} records`}</span>
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="rgb(var(--card))" strokeWidth={2}>
        {data.map((entry) => <Cell key={entry.name} fill={colors[entry.name] || '#83D63B'} />)}
      </Pie>
      <Tooltip />
      <Legend verticalAlign="bottom" height={28} iconType="circle" formatter={(value) => <span className="text-xs text-muted">{value}</span>} />
    </PieChart>
  </ResponsiveContainer>
  </>;
}
