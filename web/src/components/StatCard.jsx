export default function StatCard({ label, value, hint, icon: Icon, tone = 'accent' }) {
  const tones = {
    accent: 'bg-accent/10 text-accent border-accent/25',
    blue: 'bg-accentBlue/15 text-accentBlue border-accentBlue/25',
    success: 'bg-success/15 text-success border-success/25',
    warning: 'bg-warning/15 text-warning border-warning/25',
    danger: 'bg-danger/15 text-danger border-danger/25',
  };

  return (
    <div className="card p-5 transition hover:border-line">
      <div className="flex items-start justify-between gap-3">
        <p className="label">{label}</p>
        {Icon && (
          <span className={`grid h-9 w-9 place-items-center rounded-xl border ${tones[tone] || tones.accent}`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
        {value === null || value === undefined ? '—' : value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
