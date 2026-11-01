import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, warning, confirmLabel = 'Delete', busy, onCancel, onConfirm }) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-danger/30 bg-danger/10 text-danger">
          <AlertTriangle size={18} />
        </span>
        <div className="space-y-2 text-sm text-muted">
          <p className="text-ink">{message}</p>
          {warning && <p>{warning}</p>}
          <p>The database will refuse the change if related records still depend on it.</p>
        </div>
      </div>
    </Modal>
  );
}
