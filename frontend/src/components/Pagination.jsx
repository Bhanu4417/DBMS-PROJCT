import { ChevronLeft, ChevronRight } from 'lucide-react';

function pageNumbers(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const numbers = new Set([1, pages, page, page - 1, page + 1]);
  const sorted = [...numbers].filter((value) => value >= 1 && value <= pages).sort((a, b) => a - b);
  const result = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('…');
    result.push(value);
  });
  return result;
}

export default function Pagination({ page, pageSize, total, pages, onPage, onPageSize }) {
  if (!total) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        Showing <span className="font-medium text-ink">{start}–{end}</span> of{' '}
        <span className="font-medium text-ink">{total}</span> records
      </p>

      <div className="flex items-center gap-3">
        <select
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className="input w-auto py-1.5 text-xs"
          aria-label="Rows per page"
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-40"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          {pageNumbers(page, pages).map((number, index) =>
            number === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted">
                …
              </span>
            ) : (
              <button
                key={number}
                type="button"
                onClick={() => onPage(number)}
                className={`min-w-8 rounded-lg px-2 py-1.5 text-xs transition ${
                  number === page
                    ? 'bg-accent text-white'
                    : 'border border-line text-muted hover:text-ink'
                }`}
              >
                {number}
              </button>
            ),
          )}
          <button
            type="button"
            className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink disabled:opacity-40"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
