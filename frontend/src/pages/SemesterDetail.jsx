import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Layers } from 'lucide-react';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardSkeleton } from '../components/Skeleton';
import { useFetch } from '../hooks/useApi';
import { formatDate } from '../utils/format';

export default function SemesterDetail() {
  const { id } = useParams();
  const semester = useFetch(`/semesters/${id}`);
  const offerings = useFetch(`/semesters/${id}/offerings`);

  if (semester.error) {
    return (
      <div className="card">
        <ErrorState message={semester.error} onRetry={semester.refetch} />
      </div>
    );
  }
  if (semester.loading || !semester.data) {
    return (
      <div className="space-y-4">
        <CardSkeleton height={70} />
        <CardSkeleton height={220} />
      </div>
    );
  }

  const data = semester.data;
  const rows = offerings.data || [];

  return (
    <div className="space-y-5">
      <Link to="/semesters" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to semesters
      </Link>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accentBlue/15 text-accentBlue">
            <CalendarDays size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">
              {data.semester_name} {data.academic_year}
            </h1>
            <p className="text-sm text-muted">
              {formatDate(data.start_date)} → {formatDate(data.end_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={data.status} />
          <Link to="/semesters" className="btn-ghost text-xs">Manage records</Link>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Course offerings in this semester</h2>
            <p className="text-xs text-muted">Joined from course_offering, course and enrollment</p>
          </div>
          <span className="chip border border-line bg-soft text-muted">{rows.length} offerings</span>
        </div>

        {offerings.loading ? (
          <div className="p-5">
            <CardSkeleton height={180} />
          </div>
        ) : offerings.error ? (
          <ErrorState message={offerings.error} onRetry={offerings.refetch} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No offerings scheduled"
            message="Create a course offering for this semester to start enrolling students."
            icon={Layers}
            action={<Link to="/offerings" className="btn-primary">Create offering</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Offering</th>
                  <th className="th">Section</th>
                  <th className="th">Capacity</th>
                  <th className="th">Enrolled</th>
                  <th className="th">Seats free</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((offering) => {
                  const free = Math.max(0, offering.capacity - offering.enrolled);
                  return (
                    <tr key={offering.offering_id} className="row">
                      <td className="td">
                        <Link
                          to={`/offerings/${offering.offering_id}`}
                          className="flex flex-col hover:text-accent"
                        >
                          <span className="font-medium text-ink">{offering.course_name}</span>
                          <span className="text-xs text-muted">{offering.course_code}</span>
                        </Link>
                      </td>
                      <td className="td"><Badge value={offering.section} tone="accent" /></td>
                      <td className="td">{offering.capacity}</td>
                      <td className="td">{offering.enrolled}</td>
                      <td className="td">{free}</td>
                      <td className="td text-right">
                        <Link
                          to={`/offerings/${offering.offering_id}`}
                          className="text-xs font-medium text-accentBlue hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
