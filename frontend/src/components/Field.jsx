import { useOptions } from '../hooks/useApi';

const BASE_INPUT = 'input';

/**
 * One form control rendered from a field definition.
 * Works with react-hook-form's register() so validation stays in one place.
 */
export default function Field({ field, register, errors, disabled }) {
  const error = errors?.[field.name];
  const inputClass = `${BASE_INPUT} ${error ? 'input-error' : ''}`;
  const rules = {
    required: field.required ? `${field.label} is required` : false,
    minLength: field.minLength ? { value: field.minLength, message: `Use at least ${field.minLength} characters` } : undefined,
    min: field.min !== undefined ? { value: field.min, message: `Must be at least ${field.min}` } : undefined,
    max: field.max !== undefined ? { value: field.max, message: `Must be at most ${field.max}` } : undefined,
    pattern: field.pattern,
  };

  const common = {
    id: field.name,
    disabled: disabled || field.disabled,
    ...register(field.name, rules),
  };

  return (
    <div className={field.half ? 'sm:col-span-1' : 'sm:col-span-2'}>
      <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium text-ink">
        {field.label}
        {field.required && <span className="ml-1 text-danger">*</span>}
      </label>

      {field.type === 'select' ? (
        <SelectControl field={field} register={register} rules={rules} inputClass={inputClass} common={common} />
      ) : field.type === 'textarea' ? (
        <textarea rows={3} className={inputClass} placeholder={field.placeholder} {...common} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
          className={inputClass}
          placeholder={field.placeholder}
          step={field.step}
          min={field.min}
          max={field.max}
          {...common}
        />
      )}

      {error && <p className="mt-1.5 text-xs text-danger">{error.message}</p>}
      {!error && field.help && <p className="mt-1.5 text-xs text-muted">{field.help}</p>}
    </div>
  );
}

function SelectControl({ field, register, rules, inputClass, common }) {
  if (field.source) {
    return (
      <SourceSelect
        field={field}
        register={register}
        rules={rules}
        inputClass={inputClass}
        common={common}
      />
    );
  }
  return (
    <select className={inputClass} {...common}>
      <option value="">{field.placeholder || 'Select an option'}</option>
      {(field.options || []).map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Options loaded from the API (departments, courses, semesters…). */
function SourceSelect({ field, register, rules, inputClass, common }) {
  const { options, loading, error } = useOptions(field.source);

  return (
    <>
      <select className={inputClass} {...common}>
        <option value="">{loading ? 'Loading…' : field.placeholder || 'Select an option'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {!loading && !error && options.length === 0 && (
        <p className="mt-1.5 text-xs text-muted">No options available yet — create one on its management page first.</p>
      )}
    </>
  );
}
