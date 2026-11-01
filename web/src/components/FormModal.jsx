import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Modal from './Modal';
import Field from './Field';
import { errorMessage, fieldErrors } from '../services/api';

function buildPayload(fields, values) {
  const payload = {};
  fields.forEach((field) => {
    if (field.disabled) return;
    let value = values[field.name];
    if (value === '' || value === undefined) {
      payload[field.name] = null;
      return;
    }
    if (field.type === 'number' || field.source || field.name.endsWith('_id')) {
      const numeric = Number(value);
      payload[field.name] = Number.isNaN(numeric) ? null : numeric;
    } else {
      payload[field.name] = value;
    }
  });
  return payload;
}

export default function FormModal({
  open,
  title,
  description,
  fields,
  values,
  submitLabel = 'Save',
  onClose,
  onSubmit,
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({ defaultValues: values });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (open) {
      reset(values);
      setFormError('');
    }
  }, [open, reset, values]);

  const submit = handleSubmit(async (formValues) => {
    setBusy(true);
    setFormError('');
    try {
      await onSubmit(buildPayload(fields, formValues));
    } catch (error) {
      const serverFieldErrors = fieldErrors(error);
      if (serverFieldErrors.length) {
        serverFieldErrors.forEach((item) => {
          if (item.field) setError(item.field, { type: 'server', message: item.message });
        });
        setFormError('Some values were rejected. Please review the highlighted fields.');
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  });

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={busy ? () => {} : onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="resource-form" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      }
    >
      <form id="resource-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {formError && (
          <div className="sm:col-span-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {formError}
          </div>
        )}
        {fields.map((field) => (
          <Field key={field.name} field={field} register={register} errors={errors} disabled={busy} />
        ))}
      </form>
    </Modal>
  );
}
