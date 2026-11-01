import { Link, useParams } from '../navigation';
import { ArrowLeft, BookOpen, GraduationCap } from 'lucide-react';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import { CardSkeleton } from '../components/Skeleton';
import { useFetch } from '../hooks/useApi';

export default function CourseDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useFetch(`/courses/${id}`);

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
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to courses
      </Link>

      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warning/15 text-warning">
            <BookOpen size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">{data.course_name}</h1>
            <p className="text-sm text-muted">
              {data.course_code} · {data.credits} credits · {data.department_name}
            </p>
          </div>
        </div>
        <Link to="/courses" className="btn-ghost text-xs">Manage records</Link>
      </div>

      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-ink">Description</h2>
        <p className="text-sm leading-relaxed text-muted">
          {data.description || 'No description has been added for this course.'}
        </p>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Course offerings</h2>
          <p className="text-xs text-muted">Every semester this course has been scheduled in</p>
        </div>
        {data.offerings.length === 0 ? (
          <EmptyState
            title="Not offered yet"
            message="Create a course offering to schedule this course in a semester."
            icon={GraduationCap}
            action={<Link to="/offerings" className="btn-primary">Create offering</Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="bg-soft/60">
                  <th className="th">Semester</th>
                  <th className="th">Section</th>
                  <th className="th">Capacity</th>
                  <th className="th">Enrolled</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {data.offerings.map((offering) => (
                  <tr key={offering.offering_id} className="row">
                    <td className="td">
                      <div className="flex flex-col">
                        <span className="font-medium">{offering.semester_name}</span>
                        <span className="text-xs text-muted">{offering.academic_year}</span>
                      </div>
                    </td>
                    <td className="td"><Badge value={offering.section} tone="accent" /></td>
                    <td className="td">{offering.capacity}</td>
                    <td className="td">
                      {offering.enrolled} / {offering.capacity}
                    </td>
                    <td className="td"><Badge value={offering.semester_status} /></td>
                    <td className="td text-right">
                      <Link to={`/offerings/${offering.offering_id}`} className="text-xs font-medium text-accentBlue hover:underline">
                        View
                      </Link>
                    </td>
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
