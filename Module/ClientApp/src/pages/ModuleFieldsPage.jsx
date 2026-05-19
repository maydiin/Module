import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getFields, addField, updateField, getFieldTypes } from '../services/api';
import Icon from '../components/Icon';


function ModuleFieldsPage() {
  const { t } = useTranslation();
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const [module, setModule] = useState(null);
  const [fields, setFields] = useState([]);
  const [fieldTypes, setFieldTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    type: 'text',
    required: false,
    options: '',
    isStored: true,
    isDisplayField: false,
    orderNo: 0
  });
  const [editingFieldId, setEditingFieldId] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [moduleData, fieldsData, typesData] = await Promise.all([
        getModule(moduleId),
        getFields(moduleId),
        getFieldTypes(moduleId)
      ]);
      setModule(moduleData);
      setFields(fieldsData);
      setFieldTypes(typesData);
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError(t('required'));
      return;
    }

    if (!formData.type) {
      setError(t('required'));
      return;
    }

    try {
      const fieldData = {
        ...formData,
        name: formData.name.trim(),
        label: formData.label.trim() || formData.name.trim(),
        orderNo: parseInt(formData.orderNo) || fields.length,
        isStored: formData.type === 'formula' ? formData.isStored : true
      };

      if (editingFieldId) {
        await updateField(moduleId, editingFieldId, fieldData);
      } else {
        await addField(moduleId, fieldData);
      }

      setFormData({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: '',
        isStored: true,
        isDisplayField: false,
        orderNo: fields.length
      });
      setShowForm(false);
      setEditingFieldId(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
      console.error(err);
    }
  };

  const handleEdit = (field) => {
    setFormData({
      name: field.name,
      label: field.label || '',
      type: field.type,
      required: field.required || false,
      options: field.options || '',
      isStored: field.isStored ?? true,
      isDisplayField: field.isDisplayField || false,
      orderNo: field.orderNo || 0
    });
    setEditingFieldId(field.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          {t('back_to_modules')}
        </button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3 fade-in">
        <div className="d-flex align-items-center">
          <button
            className="btn btn-blur bg-surface bg-opacity-50 border-0 me-3 shadow-sm hover-shift-left transition-all p-3 d-none d-md-flex align-items-center justify-content-center"
            onClick={() => navigate('/')}
            style={{ borderRadius: '18px', width: '56px', height: '56px' }}
          >
            <Icon name="arrowLeft" size={24} className="icon-theme" />
          </button>
          <div>
            <h1 className="display-5 mb-1 fw-800">
              <span className="text-gradient">
                {module.name}
              </span>
              <span className="opacity-40 ms-3 fw-400" style={{ fontSize: '0.8em' }}>{t('fields_title')}</span>
            </h1>
            <p className="text-muted mb-0 lead fw-medium opacity-70" style={{ fontSize: '1rem' }}>{t('fields_subtitle')}</p>
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap align-items-center">
          <button
            className="btn btn-blur bg-surface bg-opacity-50 border-0 shadow-sm hover-lift fw-bold px-4 text-primary"
            onClick={() => navigate(`/modules/${moduleId}/layout`)}
          >
            <Icon name="dashboard" size={20} className="me-2 text-primary" /> {t('form_layout')}
          </button>
          <button
            className={`btn ${showForm ? 'btn-danger' : 'btn-primary'} px-4 shadow-premium hover-lift fw-bold`}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) setEditingFieldId(null);
            }}
          >
            {showForm ? (
              <><Icon name="x" size={20} className="me-2" /> {t('cancel')}</>
            ) : (
              <><Icon name="plus" size={20} className="me-2" /> {t('new_field')}</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-premium border-0 mb-5 overflow-hidden fade-in">
          <div className="card-header bg-gradient-to-r from-primary to-secondary py-3 border-0">
            <h5 className="card-title mb-0 text-white">
              {editingFieldId ? t('edit_attribute') : t('configure_new_attribute')}
            </h5>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-4">
                <div className="col-md-6">
                  <label htmlFor="name" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    {t('technical_name')} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control border-2"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder={t('technical_name_placeholder')}
                    required
                    autoFocus
                    disabled={!!editingFieldId}
                  />
                  <small className="form-text text-muted">{t('technical_name_help')}</small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="label" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    {t('display_label')}
                  </label>
                  <input
                    type="text"
                    className="form-control border-2"
                    id="label"
                    name="label"
                    value={formData.label}
                    onChange={handleInputChange}
                    placeholder={t('display_label_placeholder')}
                  />
                  <small className="form-text text-muted">{t('display_label_help')}</small>
                </div>

                <div className="col-md-4">
                  <label htmlFor="type" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    {t('data_type')} <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select border-2"
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingFieldId}
                  >
                    {fieldTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                {['select', 'multiselect', 'relation', 'relations', 'file', 'textarea', 'richtext', 'image', 'formula'].includes(formData.type) && (
                  <div className="col-md-8">
                    <label htmlFor="options" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                      {['relation', 'relations'].includes(formData.type) ? t('target_module') :
                        ['select', 'multiselect'].includes(formData.type) ? t('options_json') :
                          formData.type === 'file' ? t('allowed_extensions') :
                            formData.type === 'formula' ? t('formula') :
                              ['textarea', 'richtext', 'image'].includes(formData.type) ? t('configuration_json') : t('options')}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control border-2"
                      id="options"
                      name="options"
                      value={formData.options}
                      onChange={handleInputChange}
                      placeholder={
                        ['relation', 'relations'].includes(formData.type) ? 'e.g., "Categories"' :
                          ['select', 'multiselect'].includes(formData.type) ? 'e.g., ["Red", "Blue"]' :
                            formData.type === 'file' ? 'e.g., [".pdf", ".docx"]' :
                              formData.type === 'formula' ? 'e.g., {Fiyat} * {Adet}' :
                                formData.type === 'textarea' || formData.type === 'richtext' ? 'e.g., {"maxLength": 500}' :
                                  formData.type === 'image' ? 'e.g., {"maxSizeKB": 2048}' : ''
                      }
                      required
                    />
                  </div>
                )}

                <div className="col-md-4">
                  <label htmlFor="orderNo" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    {t('display_rank')}
                  </label>
                  <input
                    type="number"
                    className="form-control border-2"
                    id="orderNo"
                    name="orderNo"
                    value={formData.orderNo}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                <div className="col-md-4 d-flex align-items-center pt-md-4">
                  <div className="form-check form-switch p-2 ps-5 rounded bg-surface bg-opacity-50 border border-theme-accent w-100">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      id="required"
                      name="required"
                      checked={formData.required}
                      onChange={handleInputChange}
                      style={{ float: 'none', marginRight: '10px' }}
                    />
                    <label className="form-check-label fw-bold text-foreground opacity-80 small text-uppercase" htmlFor="required">
                      {t('mandatory')}
                    </label>
                  </div>
                  <div className="form-check form-switch p-2 ps-5 rounded bg-surface bg-opacity-50 border border-theme-accent w-100 mt-2">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      id="isDisplayField"
                      name="isDisplayField"
                      checked={formData.isDisplayField}
                      onChange={handleInputChange}
                      style={{ float: 'none', marginRight: '10px' }}
                    />
                    <label className="form-check-label fw-bold text-foreground opacity-80 small text-uppercase" htmlFor="isDisplayField">
                      {t('is_display_field')}
                    </label>
                  </div>
                </div>
                {formData.type === 'formula' && (
                  <div className="col-md-4 d-flex align-items-center pt-md-4">
                    <div className="form-check form-switch p-2 ps-5 rounded bg-surface border border-theme-accent w-100">
                      <input
                        className="form-check-input ms-0"
                        type="checkbox"
                        id="isStored"
                        name="isStored"
                        checked={formData.isStored}
                        onChange={handleInputChange}
                        style={{ float: 'none', marginRight: '10px' }}
                      />
                      <label className="form-check-label fw-bold text-muted small text-uppercase" htmlFor="isStored">
                        {t('store_in_db')}
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="d-flex gap-2 mt-5 pt-4 border-top">
                <button type="submit" className="btn btn-primary px-4">
                  {editingFieldId ? t('save_changes') : t('add_to_schema')}
                </button>
                <button
                  type="button"
                  className="btn btn-link text-muted text-decoration-none"
                  onClick={() => {
                    setShowForm(false);
                    setEditingFieldId(null);
                    setFormData({
                      name: '',
                      label: '',
                      type: 'text',
                      required: false,
                      options: '',
                      isStored: true,
                      isDisplayField: false,
                      orderNo: fields.length
                    });
                  }}
                >
                  {t('discard_changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="glass-card border-0 overflow-hidden stagger-in">
        <div className="card-header bg-surface bg-opacity-30 py-4 px-4 border-bottom border-theme-accent d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-800 d-flex align-items-center">
            <div className="text-primary me-3 d-flex align-items-center justify-content-center">
              <Icon name="settings" size={24} className="icon-theme" strokeWidth={2} />
            </div>
            {t('schema_attributes')}
            <span className="badge badge-soft-primary ms-3 px-3 rounded-pill fw-bold" style={{ fontSize: '0.8rem' }}>{fields.length}</span>
          </h5>
          <button
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
            onClick={() => navigate(`/modules/${moduleId}/records`)}
          >
            {t('manage_data')}
          </button>
        </div>
        <div className="card-body p-0">
          {fields.length === 0 ? (
            <div className="text-center py-5">
              <div className="fs-1 mb-3 opacity-25">📐</div>
              <h5 className="text-muted">{t('no_fields_defined')}</h5>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-surface bg-opacity-50">
                  <tr className="border-bottom border-theme-accent">
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0" style={{ width: '80px' }}>{t('order')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0">{t('field_name')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0">{t('display_label')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0">{t('field_type')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0">{t('options')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0">{t('status')}</th>
                    <th className="text-primary small fw-bold text-uppercase tracking-wider border-0" style={{ width: '100px' }}>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id}>
                      <td>
                        <span className="badge bg-primary">{field.orderNo}</span>
                      </td>
                      <td>
                        <code className="badge-soft-primary px-2 py-1 rounded fw-bold">{field.name}</code>
                      </td>
                      <td className="fw-semibold">{field.label}</td>
                      <td>
                        <span className="badge bg-blur text-primary border border-primary border-opacity-20 px-2 py-1">{field.type}</span>
                      </td>
                      <td>
                        {field.options ? (
                          <small className="text-muted small fw-medium">{field.options}</small>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1 align-items-start">
                          {field.required ? (
                            <span className="badge bg-danger">{t('required')}</span>
                          ) : (
                            <span className="badge bg-secondary">{t('optional')}</span>
                          )}
                          {field.isDisplayField && (
                            <span className="badge bg-primary text-white">{t('is_display_field')}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleEdit(field)}
                          title={t('edit')}
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModuleFieldsPage;

