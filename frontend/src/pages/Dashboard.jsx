import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  Layers,
  Users,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, StatSkeleton } from '../components/Skeleton';
import api, { errorMessage } from '../services/api';
import { formatDate } from '../utils/format';
import Badge from '../components/Badge';

const PALETTE = ['#7C5CFF', '#4F8CFF', '#22C55E', '#F59E0B', '#EF4444', '#14B8A6', '#A855F7', '#EC4899'];
const STATUS_COLORS = { Enrolled: '#22C55E', Completed: '#4F8CFF', Dropped: '#EF4444' };

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, error: null });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ loading: true, error: null });
    Promise.all([
      api.get('/dashboard/stats'),
      api.get('/dashboard/charts'),
      api.get('/dashboard/activity?limit=5'),
    ])
      .then(([stats, charts, activity]) => {
        if (active) {
          setState({
            loading: false,
            error: null,
            stats: stats.data,
            charts: charts.data,
            activity: activity.data,
          });
        }
      })
      .catch((error) => {
        if (active) setState({ loading: false, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (state.error) {
    return (
      <div className="card">
        <ErrorState message={state.error} onRetry={() => setRefreshKey((key) => key + 1)} />
      </div>
    );
  }

  const { stats, charts, activity, loading } = state;
  const cards = [
    { label: 'Total students', value: stats?.total_students, icon: GraduationCap, tone: 'accent', hint: `${stats?.active_enrollments ?? 0} active enrollments` },
    { label: 'Total faculty', value: stats?.total_faculty, icon: Users, tone: 'blue', hint: 'Across all departments' },
    { label: 'Departments', value: stats?.total_departments, icon: Building2, tone: 'success', hint: 'Academic units' },
    { label: 'Courses', value: stats?.total_courses, icon: BookOpen, tone: 'warning', hint: `${stats?.total_offerings ?? 0} offerings scheduled` },
    { label: 'Active enrollments', value: stats?.active_enrollments, icon: ClipboardList, tone: 'blue', hint: `${stats?.total_enrollments ?? 0} records in total` },
    { label: 'Active semesters', value: stats?.active_semesters, icon: CalendarClock, tone: 'danger', hint: 'Currently running terms' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Overview</h1>
        <p className="text-sm text-muted">
          Live figures from PostgreSQL — every card, chart and list below is a real query.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <StatSkeleton key={index} />)
          : cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Students by department" subtitle="Enrollment spread across academic units" loading={loading} className="xl:col-span-2">
          {charts?.students_by_department?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.students_by_department} barSize={38}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: 'rgba(124,92,255,0.08)' }} />
                <Bar dataKey="value" name="Students" radius={[6, 6, 0, 0]}>
                  {charts.students_by_department.map((entry, index) => (
                    <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No students yet" message="Add students to see the department breakdown." />
          )}
        </ChartCard>

        <ChartCard title="Enrollment distribution" subtitle="Status of every enrollment record" loading={loading}>
          {charts?.enrollment_distribution?.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={charts.enrollment_distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={3}
                  stroke="rgb(var(--card))"
                  strokeWidth={2}
                >
                  {charts.enrollment_distribution.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#7C5CFF'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={28} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No enrollments yet" message="Enroll a student to populate this chart." />
          )}
        </ChartCard>

        <ChartCard title="Admissions by year" subtitle="Students admitted per academic year" loading={loading} className="xl:col-span-2">
          {charts?.admissions_by_year?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={charts.admissions_by_year}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Admissions"
                  stroke="#7C5CFF"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: 'rgb(var(--card))' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No admission data" message="Admission years appear once students exist." />
          )}
        </ChartCard>

        <ChartCard title="Offerings by semester" subtitle="Scheduled course offerings" loading={loading}>
          {charts?.offerings_by_semester?.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={charts.offerings_by_semester} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(79,140,255,0.08)' }} />
                <Bar dataKey="value" name="Offerings" fill="#4F8CFF" radius={[0, 6, 6, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No offerings yet" message="Create a course offering to schedule teaching." />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ListCard
          title="Recently added students"
          icon={GraduationCap}
          loading={loading}
          link={{ to: '/students', label: 'All students' }}
          items={activity?.recent_students}
          empty={{ title: 'No students yet', message: 'Students you add will show up here.' }}
          renderItem={(student) => (
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{student.student_name}</p>
                <p className="text-xs text-muted">
                  {student.enrollment_number} · {student.department_name || 'No department'}
                </p>
              </div>
              <Badge value={student.status} />
            </div>
          )}
        />

        <ListCard
          title="Recent enrollments"
          icon={ClipboardList}
          loading={loading}
          link={{ to: '/enrollments', label: 'All enrollments' }}
          items={activity?.recent_enrollments}
          empty={{ title: 'No enrollments yet', message: 'Enrollments appear here as students register.' }}
          renderItem={(item) => (
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.student_name}</p>
                <p className="text-xs text-muted">
                  {item.course_code} · {formatDate(item.enrollment_date)}
                </p>
              </div>
              <Badge value={item.enrollment_status} />
            </div>
          )}
        />

        <ListCard
          title="Popular courses"
          icon={Award}
          loading={loading}
          link={{ to: '/reports', label: 'View reports' }}
          items={activity?.popular_courses}
          empty={{ title: 'No enrollments yet', message: 'Popular courses are ranked by active enrollments.' }}
          renderItem={(course) => (
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{course.course_name}</p>
                <p className="text-xs text-muted">
                  {course.course_code} · {course.department_code}
                </p>
              </div>
              <span className="chip border border-line bg-soft text-muted">{course.enrolled} enrolled</span>
            </div>
          )}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Department overview</h3>
            <p className="text-xs text-muted">Counts come from SQL aggregate queries</p>
          </div>
          <Link to="/departments" className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            Manage <ArrowUpRight size={13} />
          </Link>
        </div>
        {loading ? (
          <div className="p-5">
            <CardSkeleton height={140} />
          </div>
        ) : activity?.department_overview?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Department</th>
                  <th className="th">Students</th>
                  <th className="th">Faculty</th>
                  <th className="th">Courses</th>
                  <th className="th">Office</th>
                </tr>
              </thead>
              <tbody>
                {activity.department_overview.map((department) => (
                  <tr key={department.department_id} className="row">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-line bg-soft px-2 py-0.5 font-mono text-[11px]">
                          {department.department_code}
                        </span>
                        <span className="font-medium">{department.department_name}</span>
                      </div>
                    </td>
                    <td className="td">{department.students}</td>
                    <td className="td">{department.faculty}</td>
                    <td className="td">{department.courses}</td>
                    <td className="td text-muted">{department.office_location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No departments yet" message="Create a department to organise students and courses." />
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, loading, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      {loading ? <CardSkeleton height={240} /> : children}
    </section>
  );
}

function ListCard({ title, icon: Icon, items, renderItem, empty, link, loading }) {
  return (
    <section className="card flex flex-col p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/12 text-accent">
            <Icon size={15} />
          </span>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        {link && (
          <Link to={link.to} className="flex items-center gap-1 text-xs font-medium text-accent hover:underline">
            {link.label} <ArrowUpRight size={13} />
          </Link>
        )}
      </div>
      {loading ? (
        <div className="mt-2 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-9 w-full" />
          ))}
        </div>
      ) : items?.length ? (
        <div className="divide-y divide-line/70">{items.map((item, index) => <div key={index}>{renderItem(item)}</div>)}</div>
      ) : (
        <EmptyState title={empty.title} message={empty.message} icon={Layers} />
      )}
    </section>
  );
}
