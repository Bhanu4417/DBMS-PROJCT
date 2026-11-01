import { Link, useParams } from '../navigation';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardSkeleton } from '../components/Skeleton';
import { useFetch } from '../hooks/useApi';
import { formatDate } from '../utils/format';

export default function FacultyDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(`/faculty/${id}`);

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
        <CardSkeleton height={240} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/faculty" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to faculty
      </Link>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accentBlue/15 text-lg font-semibold text-accentBlue">
            {data.first_name?.[0]}
            {data.last_name?.[0]}
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">{data.full_name}</h1>
            <p className="text-sm text-muted">
              {data.employee_code} · {data.designation || 'Faculty'} · {data.department_name}
            </p>
          </div>
        </div>
        <Link to="/faculty" className="btn-ghost text-xs">
          Manage records
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-ink">Contact & appointment</h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail icon={Mail} label="Email" value={data.email} />
            <Detail icon={Phone} label="Phone" value={data.phone || '—'} />
            <Detail label="Designation" value={data.designation || '—'} />
            <Detail label="Joining date" value={formatDate(data.joining_date)} />
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Summary</h2>
          <dl className="space-y-3 text-sm">
            <SummaryRow label="Department" value={data.department_name} />
            <SummaryRow label="Employee code" value={data.employee_code} />
            <SummaryRow label="Assignments" value={data.assignments.length} />
            <SummaryRow label="Added on" value={formatDate(data.created_at)} />
          </dl>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Assigned course offerings</h2>
          <p className="text-xs text-muted">Each row links a faculty member to a course offering</p>
        </div>
        {data.assignments.length === 0 ? (
          <EmptyState
            title="No assignments yet"
            message="Assign this faculty member to a course offering."
            action={<Link to="/assignments" className="btn-primary">Create assignment</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Course</th>
                  <th className="th">Semester</th>
                  <th className="th">Section</th>
                  <th className="th">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {data.assignments.map((assignment) => (
                  <tr key={assignment.assignment_id} className="row">
                    <td className="td">
                      <div className="flex flex-col">
                        <span className="font-medium">{assignment.course_name}</span>
                        <span className="text-xs text-muted">{assignment.course_code}</span>
                      </div>
                    </td>
                    <td className="td">
                      <div className="flex flex-col">
                        <span>{assignment.semester_name}</span>
                        <span className="text-xs text-muted">{assignment.academic_year}</span>
                      </div>
                    </td>
                    <td className="td"><Badge value={assignment.section} tone="accent" /></td>
                    <td className="td text-muted">{formatDate(assignment.assigned_at)}</td>
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

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-soft text-muted">
          <Icon size={15} />
        </span>
      )}
      <div>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-sm font-medium text-ink">{value}</dd>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
