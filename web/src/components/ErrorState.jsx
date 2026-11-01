import { AlertTriangle, RotateCw } from 'lucide-react';

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle size={22} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">Could not load this data</p>
        <p className="mt-1 max-w-md text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          <RotateCw size={15} /> Try again
        </button>
      )}
    </div>
  );
}
