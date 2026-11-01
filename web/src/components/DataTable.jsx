import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Link } from '../navigation';
import Badge from './Badge';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { TableSkeleton } from './Skeleton';
import { formatDate, formatNumber } from '../utils/format';

function Cell({ column, row }) {
  const value = row[column.key];

  if (column.type === 'primary') {
    return (
      <div className="flex flex-col">
        <span className="font-medium text-ink">{value ?? '—'}</span>
        {column.sub && <span className="mt-0.5 text-xs text-muted">{row[column.sub] ?? '—'}</span>}
      </div>
    );
  }
  if (column.type === 'badge') return <Badge value={value} />;
  if (column.type === 'grade') return value ? <Badge value={value} /> : <span className="text-muted">—</span>;
  if (column.type === 'date') return <span className="text-muted">{formatDate(value)}</span>;
  if (column.type === 'count') {
    return (
      <span className="inline-flex min-w-8 items-center justify-center rounded-lg border border-line bg-soft px-2 py-1 text-xs font-semibold text-ink">
        {formatNumber(value)}
      </span>
    );
  }
  if (column.type === 'code') {
    return (
      <span className="rounded-md border border-line bg-soft px-2 py-1 font-mono text-xs text-ink">
        {value ?? '—'}
      </span>
    );
  }
  if (column.type === 'seats') {
    const enrolled = Number(row.enrolled ?? 0);
    const capacity = Number(row.capacity ?? 0);
    const full = capacity > 0 && enrolled >= capacity;
    const ratio = capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0;
    return (
      <div className="min-w-24">
        <div className="flex items-center justify-between text-xs">
          <span className={full ? 'font-semibold text-danger' : 'text-ink'}>
            {enrolled}/{capacity}
          </span>
          <span className="text-muted">{ratio}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-soft">
          <div
            className={`h-full rounded-full ${full ? 'bg-danger' : ratio > 75 ? 'bg-warning' : 'bg-accent'}`}
            style={{ width: `${ratio}%` }}
          />
        </div>
      </div>
    );
  }
  if (column.type === 'marks') {
    if (value === null || value === undefined) return <span className="text-muted">—</span>;
    return (
      <div className="flex flex-col">
        <span className="font-medium">
          {Number(value)} <span className="text-xs text-muted">/ {Number(row.max_marks)}</span>
        </span>
        {row.percentage !== null && row.percentage !== undefined && (
          <span className="text-xs text-muted">{Number(row.percentage).toFixed(1)}%</span>
        )}
      </div>
    );
  }
  return <span>{value ?? '—'}</span>;
}

export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  emptyMessage,
  emptyAction,
  detailPath,
  onEdit,
  onDelete,
  sort,
  onSort,
  actionsLabel = 'Actions',
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) {
    return (
      <div className="overflow-x-auto">
        <TableSkeleton columns={Math.min(columns.length + 1, 7)} />
      </div>
    );
  }
  if (!rows.length) {
    return <EmptyState title="No records" message={emptyMessage} action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-soft/60">
            {columns.map((column) => {
              const sortable = column.sortable;
              const active = sortable && sort.by === sortable;
              return (
                <th key={column.key} className="th whitespace-nowrap">
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(sortable)}
                      className={`inline-flex items-center gap-1 transition hover:text-ink ${active ? 'text-ink' : ''}`}
                    >
                      {column.label}
                      <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-30'}`}>
                        {active && sort.dir === 'desc' ? '▼' : '▲'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
            {(detailPath || onEdit || onDelete) && (
              <th className="th text-right">{actionsLabel}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = row[Object.keys(row).find((key) => key.endsWith('_id'))];
            return (
              <tr key={id} className="row">
                {columns.map((column) => (
                  <td key={column.key} className="td">
                    <Cell column={column} row={row} />
                  </td>
                ))}
                {(detailPath || onEdit || onDelete) && (
                  <td className="td">
                    <div className="flex items-center justify-end gap-1">
                      {detailPath && (
                        <Link
                          to={detailPath(row)}
                          className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-accentBlue"
                          title="View details"
                        >
                          <Eye size={16} />
                        </Link>
                      )}
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="rounded-lg p-2 text-muted transition hover:bg-soft hover:text-accent"
                          title="Edit record"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="rounded-lg p-2 text-muted transition hover:bg-danger/10 hover:text-danger"
                          title="Delete record"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
