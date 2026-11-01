import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Mail, Phone, UserRound } from 'lucide-react';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardSkeleton } from '../components/Skeleton';
import { useFetch } from '../hooks/useApi';
import { formatDate } from '../utils/format';

export default function StudentDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(`/students/${id}`);

  if (error) {
    return (
      <div className="card">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="space-y-4">
        <CardSkeleton height={64} />
        <CardSkeleton height={160} />
        <CardSkeleton height={260} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to students
      </Link>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-lg font-semibold text-accent">
            {data.first_name?.[0]}
            {data.last_name?.[0]}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">{data.full_name}</h1>
            <p className="text-sm text-muted">
              {data.enrollment_number} · {data.department_name || 'No department'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={data.status} />
          <Link to="/students" className="btn-ghost text-xs">
            Manage records
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink">Personal information</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Info icon={Mail} label="Email" value={data.email} />
            <Info icon={Phone} label="Phone" value={data.phone || '—'} />
            <Info icon={CalendarDays} label="Date of birth" value={formatDate(data.date_of_birth)} />
            <Info icon={UserRound} label="Gender" value={data.gender || 'Not specified'} />
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Academic profile</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Department" value={data.department_name || '—'} />
            <Row label="Admission year" value={data.admission_year} />
            <Row label="Status" value={<Badge value={data.status} />} />
            <Row label="Enrollments" value={data.enrollments.length} />
            <Row label="Added on" value={formatDate(data.created_at)} />
          </dl>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Enrollment history</h2>
          <p className="text-xs text-muted">Courses, semesters and grades joined from four tables</p>
        </div>

        {data.enrollments.length === 0 ? (
          <EmptyState
            title="No enrollments yet"
            message="This student has not been enrolled in any course offering."
            action={<Link to="/enrollments" className="btn-primary">Enroll a student</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Course</th>
                  <th className="th">Semester</th>
                  <th className="th">Section</th>
                  <th className="th">Credits</th>
                  <th className="th">Enrolled on</th>
                  <th className="th">Status</th>
                  <th className="th">Marks</th>
                  <th className="th">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.enrollments.map((record) => (
                  <tr key={record.enrollment_id} className="row">
                    <td className="td">
                      <div className="flex flex-col">
                        <span className="font-medium">{record.course_name}</span>
                        <span className="text-xs text-muted">{record.course_code}</span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <span>{record.semester_name}</span>
                        <span className="text-xs text-muted">{record.academic_year}</span>
                      </div>
                    </td>
                    <td className="td">{record.section}</td>
                    <td className="td">{record.credits}</td>
                    <td className="td text-muted">{formatDate(record.enrollment_date)}</td>
                    <td className="td"><Badge value={record.enrollment_status} /></td>
                    <td className="td">
                      {record.marks_obtained !== null
                        ? `${Number(record.marks_obtained)} / ${Number(record.max_marks)}`
                        : '—'}
                    </td>
                    <td className="td"><Badge value={record.grade_letter} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Info({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-soft text-muted">
        <Icon size={15} />
      </span>
      <div>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-sm font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
