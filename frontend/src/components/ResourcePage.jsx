import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Plus, RefreshCw, Search, X } from 'lucide-react';
import DataTable from './DataTable';
import FormModal from './FormModal';
import ConfirmDialog from './ConfirmDialog';
import Pagination from './Pagination';
import PageHeader from './PageHeader';
import { useDebounced, useFetch, invalidateOptions, useOptions } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import api, { errorMessage } from '../services/api';

/**
 * Generic management page: search, filters, sorting, pagination, create, edit
 * and delete — all driven by a config object from src/config/resources.js.
 */
export default function ResourcePage({ config }) {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const debouncedSearch = useDebounced(search);
  const [filters, setFilters] = useState({});
  const [sort, setSort] = useState(config.defaultSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formState, setFormState] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, JSON.stringify(filters), sort.by, sort.dir, pageSize]);

  const params = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      sort_by: sort.by,
      sort_dir: sort.dir,
      page,
      page_size: pageSize,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null)),
    }),
    [debouncedSearch, sort, page, pageSize, filters],
  );

  const { data, loading, error, refetch } = useFetch(config.endpoint, params);
  const rows = data?.items || [];

  const openCreate = () => {
    const values = {};
    config.fields.forEach((field) => {
      values[field.name] = field.defaultValue ?? '';
    });
    setFormState({ mode: 'create', values });
  };

  const openEdit = (row) => {
    setFormState({ mode: 'edit', row, values: config.editValues ? config.editValues(row) : row });
  };

  const submit = async (payload) => {
    const isEdit = formState.mode === 'edit';
    const id = formState.row?.[Object.keys(formState.row).find((key) => key.endsWith('_id'))];
    if (isEdit) {
      await api.put(`${config.endpoint}/${id}`, payload);
      toast.success(`${config.title.replace(/s$/, '')} updated successfully.`);
    } else {
      await api.post(config.endpoint, payload);
      toast.success(`${config.title.replace(/s$/, '')} created successfully.`);
    }
    setFormState(null);
    invalidateOptions();
    refetch();
  };

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`${config.endpoint}/${deleting.id}`);
      toast.success('Record deleted.');
      setDeleting(null);
      invalidateOptions();
      refetch();
    } catch (requestError) {
      toast.error(errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const toggleSort = useCallback(
    (columnKey) => {
      setSort((current) =>
        current.by === columnKey
          ? { by: columnKey, dir: current.dir === 'asc' ? 'desc' : 'asc' }
          : { by: columnKey, dir: 'asc' },
      );
    },
    [],
  );

  const resetFilters = () => {
    setSearch('');
    setFilters({});
    setPage(1);
  };

  const hasActiveFilters = Boolean(search) || Object.values(filters).some((value) => value !== '');

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={refetch} title="Reload from database">
              <RefreshCw size={15} /> Refresh
            </button>
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add {config.title.replace(/s$/, '').toLowerCase()}
            </button>
          </>
        }
      />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={config.searchPlaceholder}
              className="input pl-9"
              aria-label={config.searchPlaceholder}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {config.filters.map((filter) =>
              filter.source || filter.options ? (
                <FilterSelect
                  key={filter.name}
                  filter={filter}
                  value={filters[filter.name] || ''}
                  onChange={(value) => setFilters((current) => ({ ...current, [filter.name]: value }))}
                />
              ) : (
                <input
                  key={filter.name}
                  type={filter.type === 'number' ? 'number' : 'text'}
                  className="input w-36"
                  placeholder={filter.label}
                  value={filters[filter.name] || ''}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, [filter.name]: event.target.value }))
                  }
                  aria-label={filter.label}
                />
              ),
            )}

            {config.sortOptions?.length > 1 && (
              <label className="flex items-center gap-2 rounded-xl border border-line bg-soft px-2.5 py-2 text-xs text-muted">
                <ArrowDownUp size={14} />
                <span className="sr-only">Sort by</span>
                <select
                  className="bg-transparent text-xs text-ink outline-none"
                  value={sort.by}
                  onChange={(event) => setSort({ by: event.target.value, dir: sort.dir })}
                >
                  {config.sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {hasActiveFilters && (
              <button type="button" className="btn-ghost px-2.5 py-2 text-xs" onClick={resetFilters}>
                Clear
              </button>
            )}
          </div>
        </div>

        <DataTable
          columns={config.columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={refetch}
          emptyMessage={config.emptyMessage}
          detailPath={config.detailPath}
          onEdit={openEdit}
          onDelete={(row) =>
            setDeleting({
              id: row[Object.keys(row).find((key) => key.endsWith('_id'))],
              label:
                row.full_name ||
                row.student_name ||
                row.faculty_name ||
                row.course_name ||
                row.department_name ||
                row.semester_name ||
                `#${row[Object.keys(row).find((key) => key.endsWith('_id'))]}`,
            })
          }
          sort={sort}
          onSort={toggleSort}
          emptyAction={
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={15} /> Add {config.title.replace(/s$/, '').toLowerCase()}
            </button>
          }
        />

        {!error && (data?.total ?? 0) > 0 && (
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            pages={data.pages}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        )}
      </div>

      {formState && (
        <FormModal
          open
          title={formState.mode === 'edit' ? `Edit ${config.title.replace(/s$/, '').toLowerCase()}` : `Add ${config.title.replace(/s$/, '').toLowerCase()}`}
          description={
            formState.mode === 'edit'
              ? 'Changes are saved to PostgreSQL immediately.'
              : 'Required fields are marked with an asterisk.'
          }
          fields={formState.mode === 'edit' ? config.editFields || config.fields : config.fields}
          values={formState.values}
          submitLabel={formState.mode === 'edit' ? 'Save changes' : 'Create record'}
          onClose={() => setFormState(null)}
          onSubmit={submit}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this record?"
        message={`You are about to delete ${deleting?.label || 'this record'}. This action cannot be undone.`}
        warning={config.deleteWarning}
        busy={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function FilterSelect({ filter, value, onChange }) {
  const { options, loading: sourceLoading } = useOptions(filter.source);
  const items = filter.source ? options : filter.options;
  const loading = filter.source ? sourceLoading : false;
  return (
    <select
      className="input w-auto min-w-36"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={filter.label}
      disabled={loading}
    >
      <option value="">{loading ? 'Loading…' : filter.allLabel || `All ${filter.label.toLowerCase()}`}</option>
      {items.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
