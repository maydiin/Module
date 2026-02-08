import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getFields, addField, getFieldTypes } from '../services/api';

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
    orderNo: 0
  });

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
        orderNo: parseInt(formData.orderNo) || fields.length
      };
      await addField(moduleId, fieldData);
      setFormData({
        name: '',
        label: '',
        type: 'text',
        required: false,
        options: '',
        orderNo: fields.length
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
      console.error(err);
    }
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
          ← {t('back_to_modules')}
        </button>
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
            <span className="opacity-50 me-2">⚙️</span>
            {module.name} {t('fields_title')}
          </h1>
          <p className="text-muted mb-0">{t('fields_subtitle')}</p>
        </div>
        <button
          className={`btn ${showForm ? 'btn-outline-danger' : 'btn-primary'} btn-lg px-4 shadow-sm`}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <span className="fs-5">✕</span> {t('cancel')}
            </>
          ) : (
            <>
              <span className="fs-5">+</span> {t('new_field')}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-lg border-0 mb-5 overflow-hidden">
          <div className="card-header bg-primary py-3">
            <h5 className="card-title mb-0 text-white">{t('configure_new_attribute')}</h5>
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
                    placeholder="e.g. firstName"
                    required
                    autoFocus
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
                    placeholder="e.g. First Name"
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
                  >
                    {fieldTypes.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                {['select', 'multiselect', 'relation', 'file', 'textarea', 'richtext', 'image'].includes(formData.type) && (
                  <div className="col-md-8">
                    <label htmlFor="options" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                      {formData.type === 'relation' ? t('target_module') :
                        ['select', 'multiselect'].includes(formData.type) ? t('options_json') :
                          formData.type === 'file' ? t('allowed_extensions') :
                            ['textarea', 'richtext', 'image'].includes(formData.type) ? t('configuration_json') : 'Options'}
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
                        formData.type === 'relation' ? 'e.g., "Categories"' :
                          ['select', 'multiselect'].includes(formData.type) ? 'e.g., ["Red", "Blue"]' :
                            formData.type === 'file' ? 'e.g., [".pdf", ".docx"]' :
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
                  <div className="form-check form-switch p-2 ps-5 rounded bg-light border w-100">
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      id="required"
                      name="required"
                      checked={formData.required}
                      onChange={handleInputChange}
                      style={{ float: 'none', marginRight: '10px' }}
                    />
                    <label className="form-check-label fw-bold text-muted small text-uppercase" htmlFor="required">
                      {t('mandatory')}
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mt-5 pt-4 border-top">
                <button type="submit" className="btn btn-primary px-4">
                  <span>✓</span> {t('add_to_schema')}
                </button>
                <button
                  type="button"
                  className="btn btn-link text-muted text-decoration-none"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      name: '',
                      label: '',
                      type: 'text',
                      required: false,
                      options: '',
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

      <div className="card shadow-soft border-0 overflow-hidden">
        <div className="card-header bg-white py-4 px-4 border-bottom d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">
            <span className="opacity-75 me-2">📋</span>
            {t('schema_attributes')}
            <span className="badge bg-light text-primary border ms-2 px-3 rounded-pill fw-normal">{fields.length}</span>
          </h5>
          <button
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
            onClick={() => navigate(`/modules/${moduleId}/records`)}
          >
            📋 {t('manage_data')}
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
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '80px' }}>{t('order')}</th>
                    <th>{t('field_name')}</th>
                    <th>{t('display_label')}</th>
                    <th>{t('field_type')}</th>
                    <th>Options</th>
                    <th>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => (
                    <tr key={field.id}>
                      <td>
                        <span className="badge bg-primary">{field.orderNo}</span>
                      </td>
                      <td>
                        <code className="bg-light px-2 py-1 rounded">{field.name}</code>
                      </td>
                      <td className="fw-semibold">{field.label}</td>
                      <td>
                        <span className="badge bg-info text-dark">{field.type}</span>
                      </td>
                      <td>
                        {field.options ? (
                          <small className="text-muted">{field.options}</small>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        {field.required ? (
                          <span className="badge bg-danger">{t('required')}</span>
                        ) : (
                          <span className="badge bg-secondary">{t('optional')}</span>
                        )}
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

