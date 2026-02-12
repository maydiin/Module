import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getFields, getRecords, createRecord, updateRecord, deleteRecord } from '../services/api';
import DynamicForm from '../components/DynamicForm';
import LinkedRecordsModal from '../components/LinkedRecordsModal';
import { useTenant } from '../components/TenantContext';

function ModuleRecordsPage() {
  const { t } = useTranslation();
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [fields, setFields] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [error, setError] = useState('');
  const [showLinkedModal, setShowLinkedModal] = useState(false);
  const [selectedRecordForLinks, setSelectedRecordForLinks] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDrafts, setFilterDrafts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [showFilterPanel, setShowFilterPanel] = useState(true);
  const { selectedTenantId } = useTenant();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, page, pageSize, sortBy, sortDir, searchQuery, filters, selectedTenantId]);

  useEffect(() => {
    setPage(1);
    setPageSize(20);
    setSortBy('createdAt');
    setSortDir('desc');
    setSearchInput('');
    setSearchQuery('');
    setFilterDrafts([]);
    setFilters([]);
    setShowFilterPanel(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [moduleData, fieldsData, recordsData] = await Promise.all([
        getModule(moduleId),
        getFields(moduleId),
        getRecords(moduleId, {
          page,
          pageSize,
          search: searchQuery || undefined,
          sortBy,
          sortDir,
          filters: filters.length > 0 ? JSON.stringify(filters) : undefined
        })
      ]);
      setModule(moduleData);
      setFields(fieldsData);
      setRecords(recordsData.items || []);
      setTotal(recordsData.total || 0);
      setTotalPages(recordsData.totalPages || 1);
      setPage(recordsData.page || page);
      setPageSize(recordsData.pageSize || pageSize);
    } catch (err) {
      if (err.response?.status === 404) {
        setModule(null);
      } else {
        setError(err.response?.data?.error || t('error'));
        setModule({ id: -1, name: 'Error' });
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setError('');
      if (editingRecord) {
        await updateRecord(moduleId, editingRecord.id, formData);
      } else {
        await createRecord(moduleId, formData);
      }
      setShowForm(false);
      setEditingRecord(null);
      setPage(1);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
      console.error(err);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm(t('confirm_delete_record'))) {
      return;
    }

    try {
      await deleteRecord(moduleId, recordId);
      if (records.length === 1 && page > 1) {
        setPage(page - 1);
      }
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  const applyFilters = () => {
    setSearchQuery(searchInput.trim());
    setFilters(filterDrafts);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setFilterDrafts([]);
    setFilters([]);
    setPage(1);
  };

  const addFilterRow = () => {
    const defaultField = fields[0]?.name || '__id';
    setFilterDrafts(prev => [...prev, { field: defaultField, operator: 'contains', value: '', valueTo: '' }]);
  };

  const updateFilterRow = (index, updates) => {
    setFilterDrafts(prev => prev.map((filter, i) => (i === index ? { ...filter, ...updates } : filter)));
  };

  const removeFilterRow = (index) => {
    setFilterDrafts(prev => prev.filter((_, i) => i !== index));
  };

  const systemFields = [
    { name: '__id', label: 'ID', type: 'number' },
    { name: '__createdAt', label: t('created_at'), type: 'datetime' },
    { name: '__linkedCount', label: t('linked_count'), type: 'number' }
  ];

  const allFilterFields = [...systemFields, ...fields];

  const getFieldMeta = (fieldName) => {
    return allFilterFields.find(field => field.name === fieldName) || { name: fieldName, label: fieldName, type: 'text' };
  };

  const getFieldOptions = (field) => {
    if (!field?.options) {
      return [];
    }
    try {
      const parsed = JSON.parse(field.options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const operatorOptions = {
    text: [
      { value: 'contains', label: t('filter_contains') },
      { value: 'eq', label: t('filter_equals') },
      { value: 'starts', label: t('filter_starts') },
      { value: 'ends', label: t('filter_ends') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    number: [
      { value: 'eq', label: t('filter_equals') },
      { value: 'ne', label: t('filter_not_equals') },
      { value: 'gt', label: t('filter_greater') },
      { value: 'gte', label: t('filter_greater_equal') },
      { value: 'lt', label: t('filter_less') },
      { value: 'lte', label: t('filter_less_equal') },
      { value: 'between', label: t('filter_between') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    date: [
      { value: 'eq', label: t('filter_on') },
      { value: 'before', label: t('filter_before') },
      { value: 'after', label: t('filter_after') },
      { value: 'between', label: t('filter_between') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    datetime: [
      { value: 'eq', label: t('filter_on') },
      { value: 'before', label: t('filter_before') },
      { value: 'after', label: t('filter_after') },
      { value: 'between', label: t('filter_between') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    checkbox: [
      { value: 'eq', label: t('filter_is') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    select: [
      { value: 'eq', label: t('filter_equals') },
      { value: 'in', label: t('filter_in_list') },
      { value: 'contains', label: t('filter_contains') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    multiselect: [
      { value: 'contains', label: t('filter_contains') },
      { value: 'in', label: t('filter_in_list') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ],
    default: [
      { value: 'contains', label: t('filter_contains') },
      { value: 'eq', label: t('filter_equals') },
      { value: 'isempty', label: t('filter_is_empty') },
      { value: 'isnotempty', label: t('filter_is_not_empty') }
    ]
  };

  const resolveOperatorOptions = (fieldType) => {
    if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage') {
      return operatorOptions.number;
    }
    if (fieldType === 'date') {
      return operatorOptions.date;
    }
    if (fieldType === 'datetime') {
      return operatorOptions.datetime;
    }
    if (fieldType === 'checkbox') {
      return operatorOptions.checkbox;
    }
    if (fieldType === 'select') {
      return operatorOptions.select;
    }
    if (fieldType === 'multiselect') {
      return operatorOptions.multiselect;
    }
    if (fieldType === 'textarea' || fieldType === 'richtext' || fieldType === 'email' || fieldType === 'phone') {
      return operatorOptions.text;
    }
    return operatorOptions.default;
  };

  const getValueInputType = (fieldType) => {
    if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percentage') {
      return 'number';
    }
    if (fieldType === 'date') {
      return 'date';
    }
    if (fieldType === 'datetime') {
      return 'datetime-local';
    }
    return 'text';
  };

  const buildSortOptions = () => [
    { value: 'createdAt', label: t('created_at') },
    { value: 'id', label: 'ID' },
    { value: '__linkedCount', label: t('linked_count') },
    ...fields.map(field => ({ value: field.name, label: field.label }))
  ];

  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, total);

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-2 text-muted">{t('loading')}</p>
      </div>
    );
  }

  if (module === null) {
    return (
      <div className="alert alert-danger shadow-sm">
        <h5 className="alert-heading">{t('module_not_found')}</h5>
        <p className="mb-0">{t('module_not_found_desc')}</p>
        <hr />
        <button className="btn btn-outline-danger" onClick={() => navigate('/')}>
          ← {t('back_to_modules')}
        </button>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <button
              className="btn btn-link mb-2 p-0 text-decoration-none"
              onClick={() => navigate('/')}
            >
              ← {t('back_to_modules')}
            </button>
            <h1 className="mb-0">{t('records_title')} {module.name}</h1>
            <p className="text-muted mb-0">{t('records_subtitle')}</p>
          </div>
        </div>
        <div className="alert alert-warning shadow-sm">
          <h6 className="alert-heading">{t('no_fields_defined_title')}</h6>
          <p className="mb-3">{t('no_fields_defined_desc')}</p>
          <button
            className="btn btn-warning"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            ⚙️ {t('manage_fields')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
        <div>
          <button
            className="btn btn-link mb-2 p-0 text-decoration-none text-primary d-flex align-items-center gap-2"
            onClick={() => navigate('/')}
          >
            <span>←</span> {t('back_to_dashboard')}
          </button>
          <h1 className="display-6 mb-1">
            <span className="opacity-50 me-2">📋</span>
            {module.name} {t('records_title')}
          </h1>
          <p className="text-muted mb-0">{t('records_subtitle')}</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary border-2 px-4 shadow-sm"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            ⚙️ {t('schema')}
          </button>
          <button
            className="btn btn-primary px-4 shadow-sm"
            onClick={() => {
              setEditingRecord(null);
              setShowForm(true);
            }}
            disabled={showForm}
          >
            <span>+</span> {t('new_entry')}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-lg border-0 mb-5 overflow-hidden">
          <div className={`card-header py-3 ${editingRecord ? 'bg-warning' : 'bg-primary'}`}>
            <h5 className="card-title mb-0 text-white">
              {editingRecord ? `✏️ ${t('update_existing_record')}` : `➕ ${t('forge_new_record')}`}
            </h5>
          </div>
          <div className="card-body p-4">
            <DynamicForm
              fields={fields}
              initialData={editingRecord?.data || {}}
              onSubmit={handleFormSubmit}
              submitLabel={editingRecord ? t('save_changes') : t('initialize_record')}
            />
            <button
              className="btn btn-link text-muted mt-3 text-decoration-none"
              onClick={handleCancel}
            >
              {t('discard_actions')}
            </button>
          </div>
        </div>
      )}

      <div className="card shadow-sm border-0 mb-4">
        <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
          <h6 className="mb-0">{t('filters_panel_title')}</h6>
          <button
            className="btn btn-sm btn-outline-secondary"
            type="button"
            onClick={() => setShowFilterPanel(prev => !prev)}
          >
            {showFilterPanel ? t('hide_filters_panel') : t('show_filters_panel')}
          </button>
        </div>
        {showFilterPanel && (
          <div className="card-body">
            <div className="d-flex flex-column flex-lg-row gap-3 align-items-lg-end">
              <div className="flex-grow-1">
                <label className="form-label text-muted mb-1">{t('search')}</label>
                <div className="input-group">
                  <span className="input-group-text">🔍</span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={t('search_records_placeholder')}
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        applyFilters();
                      }
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="form-label text-muted mb-1">{t('sort_by')}</label>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setPage(1);
                  }}
                >
                  {buildSortOptions().map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label text-muted mb-1">{t('sort_direction')}</label>
                <select
                  className="form-select"
                  value={sortDir}
                  onChange={(event) => {
                    setSortDir(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="desc">{t('sort_desc')}</option>
                  <option value="asc">{t('sort_asc')}</option>
                </select>
              </div>
              <div>
                <label className="form-label text-muted mb-1">{t('page_size')}</label>
                <select
                  className="form-select"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-primary px-3" onClick={applyFilters}>
                  {t('apply_filters')}
                </button>
                <button className="btn btn-outline-secondary px-3" onClick={clearFilters}>
                  {t('clear_filters')}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                <h6 className="mb-0">{t('advanced_filters')}</h6>
                <button className="btn btn-sm btn-outline-primary" onClick={addFilterRow}>
                  + {t('add_filter')}
                </button>
              </div>

              {filterDrafts.length === 0 ? (
                <div className="text-muted small">{t('no_filters_applied')}</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filterDrafts.map((filter, index) => {
                    const fieldMeta = getFieldMeta(filter.field);
                    const operators = resolveOperatorOptions(fieldMeta.type);
                    const options = getFieldOptions(fieldMeta);
                    const operator = filter.operator || operators[0]?.value || 'contains';
                    const showValueInputs = !['isempty', 'isnotempty'].includes(operator);
                    const showBetween = operator === 'between';
                    return (
                      <div key={`${filter.field}-${index}`} className="row g-2 align-items-end">
                        <div className="col-12 col-md-4">
                          <label className="form-label text-muted mb-1">{t('filter_field')}</label>
                          <select
                            className="form-select"
                            value={filter.field}
                            onChange={(event) => updateFilterRow(index, { field: event.target.value })}
                          >
                            {allFilterFields.map(field => (
                              <option key={field.name} value={field.name}>{field.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label text-muted mb-1">{t('filter_operator')}</label>
                          <select
                            className="form-select"
                            value={operator}
                            onChange={(event) => updateFilterRow(index, { operator: event.target.value })}
                          >
                            {operators.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        {showValueInputs && (
                          <div className="col-12 col-md-4">
                            <label className="form-label text-muted mb-1">{t('filter_value')}</label>
                            {fieldMeta.type === 'checkbox' ? (
                              <select
                                className="form-select"
                                value={filter.value ?? ''}
                                onChange={(event) => updateFilterRow(index, { value: event.target.value })}
                              >
                                <option value="true">{t('yes')}</option>
                                <option value="false">{t('no')}</option>
                              </select>
                            ) : options.length > 0 && !showBetween ? (
                              <select
                                className="form-select"
                                value={filter.value ?? ''}
                                onChange={(event) => updateFilterRow(index, { value: event.target.value })}
                              >
                                <option value="">{t('select_option')}</option>
                                {options.map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={getValueInputType(fieldMeta.type)}
                                className="form-control"
                                value={filter.value ?? ''}
                                onChange={(event) => updateFilterRow(index, { value: event.target.value })}
                                placeholder={operator === 'in' ? t('filter_comma_hint') : ''}
                              />
                            )}
                          </div>
                        )}
                        {showBetween && (
                          <div className="col-12 col-md-4">
                            <label className="form-label text-muted mb-1">{t('filter_value_to')}</label>
                            <input
                              type={getValueInputType(fieldMeta.type)}
                              className="form-control"
                              value={filter.valueTo ?? ''}
                              onChange={(event) => updateFilterRow(index, { valueTo: event.target.value })}
                            />
                          </div>
                        )}
                        <div className="col-12 col-md-1 d-flex">
                          <button className="btn btn-outline-danger w-100" onClick={() => removeFilterRow(index)}>
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card shadow-soft border-0 overflow-hidden">
        <div className="card-header bg-white py-4 px-4 border-bottom">
          <h5 className="mb-0 fw-bold">
            <span className="opacity-75 me-2">📁</span>
            {t('data_inventory')}
            <span className="badge bg-light text-primary border ms-2 px-3 rounded-pill fw-normal">{total}</span>
          </h5>
        </div>
        <div className="card-body p-0">
          {records.length === 0 ? (
            <div className="text-center py-5">
              <div className="fs-1 mb-3 opacity-25">📂</div>
              <h5 className="text-muted">{t('inventory_empty')}</h5>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th style={{ width: '120px' }}>{t('linked_count')}</th>
                      {fields.map(field => (
                        <th key={field.id}>{field.label}</th>
                      ))}
                      <th style={{ width: '180px' }}>{t('created_at')}</th>
                      <th style={{ width: '150px' }}>{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <span className="badge bg-secondary">#{record.id}</span>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm ${record.linkedCount > 0 ? 'btn-info text-white' : 'btn-outline-secondary opacity-50'}`}
                            onClick={() => {
                              if (record.linkedCount > 0) {
                                setSelectedRecordForLinks(record);
                                setShowLinkedModal(true);
                              }
                            }}
                            disabled={record.linkedCount === 0}
                            title={record.linkedCount > 0 ? t('view_linked_records') : t('no_linked_records')}
                          >
                            📎 {record.linkedCount || 0}
                          </button>
                        </td>
                        {fields.map(field => (
                          <td key={field.id}>
                            {field.type === 'checkbox' ? (
                              record.data[field.name] ? (
                                <span className="badge bg-success">✓ {t('yes')}</span>
                              ) : (
                                <span className="badge bg-secondary">✗ {t('no')}</span>
                              )
                            ) : (
                              <span>
                                {Array.isArray(record.data[field.name])
                                  ? record.data[field.name].join(', ')
                                  : (record.data[field.name] || <span className="text-muted">-</span>)}
                              </span>
                            )}
                          </td>
                        ))}
                        <td>
                          <small className="text-muted">
                            {new Date(record.createdAt).toLocaleString()}
                          </small>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm" role="group">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleEdit(record)}
                              disabled={showForm}
                              title={t('save_changes')}
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDelete(record.id)}
                              disabled={showForm}
                              title={t('delete_record')}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 px-4 py-3 border-top">
                <div className="text-muted small">
                  {t('showing_results', { start: pageStart, end: pageEnd, total })}
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                  >
                    {t('previous')}
                  </button>
                  <span className="text-muted small">
                    {t('page_of', { page, totalPages })}
                  </span>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showLinkedModal && selectedRecordForLinks && (
        <LinkedRecordsModal
          moduleName={module.name}
          recordId={selectedRecordForLinks.id}
          onClose={() => {
            setShowLinkedModal(false);
            setSelectedRecordForLinks(null);
          }}
        />
      )}
    </div>
  );
}

export default ModuleRecordsPage;
