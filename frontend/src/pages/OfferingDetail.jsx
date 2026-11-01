import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Users } from 'lucide-react';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardSkeleton } from '../components/Skeleton';
import { useFetch } from '../hooks/useApi';

export default function OfferingDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(`/offerings/${id}`);

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
        <CardSkeleton height={150} />
        <CardSkeleton height={260} />
      </div>
    );
  }

  const utilisation = data.capacity ? Math.round((data.enrolled / data.capacity) * 100) : 0;
  const full = data.enrolled >= data.capacity;

  return (
    <div className="space-y-5">
      <Link to="/offerings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to course offerings
      </Link>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Layers size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">{data.course_name}</h1>
            <p className="text-sm text-muted">
              {data.course_code} · Section {data.section} · {data.semester_name} {data.academic_year}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={full ? 'Full' : `${data.seats_available} seats free`} tone={full ? 'danger' : 'success'} />
          <Link to="/offerings" className="btn-ghost text-xs">Manage records</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">Capacity utilisation</h2>
          <div className="flex items-end justify-between text-sm">
            <span className="text-2xl font-semibold text-ink">
              {data.enrolled}
              <span className="text-base font-normal text-muted"> / {data.capacity} students</span>
            </span>
            <span className={full ? 'text-danger' : 'text-muted'}>{utilisation}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-soft">
            <div
              className={`h-full rounded-full ${full ? 'bg-danger' : utilisation > 75 ? 'bg-warning' : 'bg-accent'}`}
              style={{ width: `${Math.min(100, utilisation)}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted">
            Capacity is enforced by a PostgreSQL row lock and trigger, so concurrent enrollments
            cannot exceed this limit.
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Faculty assigned</h2>
          {data.faculty.length === 0 ? (
            <p className="text-sm text-muted">No faculty member is assigned yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.faculty.map((member) => (
                <li key={member.assignment_id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{member.faculty_name}</p>
                    <p className="text-xs text-muted">
                      {member.employee_code} · {member.department_name}
                    </p>
                  </div>
                  <Link to={`/faculty/${member.faculty_id}`} className="text-xs text-accentBlue hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Enrolled students</h2>
          <p className="text-xs text-muted">Joined from enrollment, student and grade tables</p>
        </div>
        {data.students.length === 0 ? (
          <EmptyState
            title="No students enrolled"
            message="Enroll a student into this offering from the enrollments page."
            icon={Users}
            action={<Link to="/enrollments" className="btn-primary">Enroll student</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Student</th>
                  <th className="th">Enrollment number</th>
                  <th className="th">Status</th>
                  <th className="th">Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.enrollment_id} className="row">
                    <td className="td">
                      <Link to={`/students/${student.student_id}`} className="font-medium text-ink hover:text-accent">
                        {student.student_name}
                      </Link>
                    </td>
                    <td className="td text-muted">{student.enrollment_number}</td>
                    <td className="td"><Badge value={student.enrollment_status} /></td>
                    <td className="td"><Badge value={student.grade_letter} /></td>
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
