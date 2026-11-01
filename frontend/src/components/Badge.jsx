const TONES = {
  success: 'bg-success/15 text-success border-success/25',
  info: 'bg-accentBlue/15 text-accentBlue border-accentBlue/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  danger: 'bg-danger/15 text-danger border-danger/25',
  muted: 'bg-soft text-muted border-line',
  accent: 'bg-accent/15 text-accent border-accent/25',
};

const STATUS_TONES = {
  Active: 'success',
  Enrolled: 'success',
  Completed: 'info',
  Upcoming: 'warning',
  Graduated: 'info',
  Inactive: 'muted',
  Dropped: 'danger',
  'A+': 'success',
  A: 'success',
  'B+': 'info',
  B: 'info',
  C: 'warning',
  D: 'warning',
  F: 'danger',
};

export default function Badge({ value, tone }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-muted">—</span>;
  }
  const resolved = tone || STATUS_TONES[value] || 'muted';
  return (
    <span className={`chip border ${TONES[resolved] || TONES.muted}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
