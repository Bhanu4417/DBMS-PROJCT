import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const events = [];
let sequence = 0;

// Store templates only, never parameters or literal data. Authentication is excluded.
export function recordSql(sql, duration, rows) {
  const context = storage.getStore();
  if (!context || /account|session|login_throttle/i.test(String(sql))) return;
  const template = String(sql).replace(/'(?:''|[^'])*'/g, '?').replace(/\b\d+(?:\.\d+)?\b/g, '?').slice(0, 4000);
  const event = {
    id: ++sequence, request_id: context.request_id, timestamp: new Date().toISOString(),
    method: context.method, path: context.path, role: context.role,
    account_id: context.account_id ?? null, student_id: context.student_id ?? null,
    sql: template, duration_ms: Number.isFinite(duration) ? Math.max(0, duration) : 0,
    rows: Number.isFinite(Number(rows)) ? Number(rows) : null, success: null,
  };
  context.records.push(event);
  events.push(event);
  if (events.length > 200) events.splice(0, events.length - 200);
}

export async function withSqlAudit(meta, fn) {
  const context = { ...meta, records: [] };
  return storage.run(context, async () => {
    try {
      const result = await fn();
      for (const event of context.records) event.success = (result?.status ?? 200) < 400;
      return result;
    } catch (error) {
      for (const event of context.records) event.success = false;
      throw error;
    }
  });
}

export function getSqlAudit() { return events.map(event => ({ ...event })); }
