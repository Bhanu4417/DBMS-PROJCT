import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import api, { errorMessage, API_BASE } from '../services/api';
import { downloadCsv } from '../utils/format';

const TABS = [
  { key: 'students', label: 'Student reports', endpoint: '/reports/students' },
  { key: 'faculty', label: 'Faculty reports', endpoint: '/reports/faculty' },
  { key: 'academic', label: 'Academic reports', endpoint: '/reports/academic' },
];

const TABLES = {
  students: [
    { key: 'by_department', title: 'Students by department', columns: [
      { key: 'department_code', label: 'Code' },
      { key: 'department_name', label: 'Department' },
      { key: 'students', label: 'Students' },
    ] },
    { key: 'by_admission_year', title: 'Students by admission year', columns: [
      { key: 'admission_year', label: 'Admission year' },
      { key: 'students', label: 'Students' },
    ] },
    { key: 'by_status', title: 'Active vs inactive students', columns: [
      { key: 'status', label: 'Status' },
      { key: 'students', label: 'Students' },
    ] },
  ],
  faculty: [
    { key: 'by_department', title: 'Faculty by department', columns: [
      { key: 'department_code', label: 'Code' },
      { key: 'department_name', label: 'Department' },
      { key: 'faculty', label: 'Faculty' },
    ] },
    { key: 'assignments', title: 'Faculty course assignments', columns: [
      { key: 'employee_code', label: 'Employee code' },
      { key: 'faculty_name', label: 'Faculty' },
      { key: 'course_code', label: 'Course' },
      { key: 'semester_name', label: 'Semester' },
      { key: 'academic_year', label: 'Year' },
      { key: 'section', label: 'Section' },
    ] },
  ],
  academic: [
    { key: 'course_enrollment', title: 'Course enrollment counts', columns: [
      { key: 'course_code', label: 'Course' },
      { key: 'course_name', label: 'Name' },
      { key: 'offerings', label: 'Offerings' },
      { key: 'enrolled', label: 'Enrolled' },
    ] },
    { key: 'capacity_utilization', title: 'Course capacity utilisation', columns: [
      { key: 'course_code', label: 'Course' },
      { key: 'semester_name', label: 'Semester' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'enrolled', label: 'Enrolled' },
      { key: 'utilisation_percent', label: 'Utilisation %' },
    ] },
    { key: 'semester_summary', title: 'Semester enrollment summary', columns: [
      { key: 'semester_name', label: 'Semester' },
      { key: 'academic_year', label: 'Year' },
      { key: 'status', label: 'Status' },
      { key: 'offerings', label: 'Offerings' },
      { key: 'enrollments', label: 'Enrollments' },
      { key: 'students', label: 'Students' },
    ] },
    { key: 'student_grades', title: 'Student grade report', columns: [
      { key: 'enrollment_number', label: 'Enrollment no.' },
      { key: 'student_name', label: 'Student' },
      { key: 'course_code', label: 'Course' },
      { key: 'marks_obtained', label: 'Marks' },
      { key: 'max_marks', label: 'Max' },
      { key: 'grade_letter', label: 'Grade' },
    ] },
  ],
};

export default function Reports() {
  const [tab, setTab] = useState('students');
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ loading: true, data: null, error: null });
    const endpoint = TABS.find((item) => item.key === tab).endpoint;
    api
      .get(endpoint)
      .then((response) => {
        if (active) setState({ loading: false, data: response.data, error: null });
      })
      .catch((error) => {
        if (active) setState({ loading: false, data: null, error: errorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [tab]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Aggregated academic reports straight from SQL. Export any table to CSV."
        actions={
          <a
            className="btn-ghost"
            href={`${API_BASE}/reports/export?report=students-by-department`}
            target="_blank"
            rel="noreferrer"
          >
            <FileSpreadsheet size={15} /> Server CSV (students by department)
          </a>
        }
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-xl border px-3.5 py-2 text-sm transition ${
              tab === item.key
                ? 'border-accent/40 bg-accent/10 font-medium text-accent'
                : 'border-line bg-panel text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {state.error ? (
        <div className="card">
          <ErrorState message={state.error} onRetry={() => setTab(tab)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {TABLES[tab].map((table) => (
            <ReportTable
              key={table.key}
              table={table}
              rows={state.data?.[table.key] || []}
              loading={state.loading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportTable({ table, rows, loading }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{table.title}</h3>
          <p className="text-xs text-muted">{rows.length} row{rows.length === 1 ? '' : 's'}</p>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={() => downloadCsv(`${table.key}.csv`, table.columns, rows)}
          disabled={!rows.length}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} columns={table.columns.length} />
      ) : rows.length === 0 ? (
        <EmptyState title="No data" message="This report will fill in once records exist." />
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[560px]">
            <thead className="sticky top-0 bg-soft">
              <tr>
                {table.columns.map((column) => (
                  <th key={column.key} className="th">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="row">
                  {table.columns.map((column) => (
                    <td key={column.key} className="td">
                      {row[column.key] === null || row[column.key] === undefined ? '—' : String(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
