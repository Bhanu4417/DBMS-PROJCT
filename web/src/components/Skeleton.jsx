export function TableSkeleton({ rows = 6, columns = 5 }) {
  return (
    <div className="divide-y divide-line/70">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="skeleton h-3.5"
              style={{ width: columnIndex === 1 ? '26%' : `${12 + ((rowIndex + columnIndex) % 3) * 4}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 120 }) {
  return <div className="skeleton" style={{ height }} />;
}

export function StatSkeleton() {
  return (
    <div className="card p-5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-4 h-7 w-16" />
    </div>
  );
}
