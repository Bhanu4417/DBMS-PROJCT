import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Nothing here yet', message, action, icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-soft text-muted">
        <Icon size={22} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      </div>
      {action}
    </div>
  );
}
