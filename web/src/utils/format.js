export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-IN');
}

export function formatPercent(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${Number(value).toFixed(1)}%`;
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function toInputDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

export function titleCase(value = '') {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Download rows as CSV, used by the Reports page. */
export function downloadCsv(filename, columns, rows) {
  const escape = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const lines = [columns.map((column) => escape(column.label)).join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((column) => escape(row[column.key])).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
