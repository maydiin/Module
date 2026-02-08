import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModule, getFields, addField, getFieldTypes } from '../services/api';

function ModuleFieldsPage() {
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
        setError(err.response?.data?.error || 'Failed to load data from server. Check if database is updated.');
        setModule({ id: -1, name: 'Error' }); // Prevent "Module not found" alert from hiding the error
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
      setError('Field name is required');
      return;
    }

    if (!formData.type) {
      setError('Field type is required');
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
      setError(err.response?.data?.error || 'Failed to add field');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Loading fields...</p>
      </div>
    );
  }

  if (module === null) {
    return (
      <div className="alert alert-danger shadow-sm">
        <h5 className="alert-heading">Module not found</h5>
        <p className="mb-0">The module you're looking for doesn't exist.</p>
        <hr />
        <button className="btn btn-outline-danger" onClick={() => navigate('/')}>
          ← Back to Modules
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
            <span>←</span> Back to Dashboard
          </button>
          <h1 className="display-6 mb-1">
            <span className="opacity-50 me-2">⚙️</span>
            {module.name} Structure
          </h1>
          <p className="text-muted mb-0">Define and calibrate the schema for this dynamic module.</p>
        </div>
        <button
          className={`btn ${showForm ? 'btn-outline-danger' : 'btn-primary'} btn-lg px-4 shadow-sm`}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <span className="fs-5">✕</span> Cancel
            </>
          ) : (
            <>
              <span className="fs-5">+</span> New Field
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
            <h5 className="card-title mb-0 text-white">Configure New Attribute</h5>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="row g-4">
                <div className="col-md-6">
                  <label htmlFor="name" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    Technical Name <span className="text-danger">*</span>
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
                  <small className="form-text text-muted">Used for internal data mapping.</small>
                </div>
                <div className="col-md-6">
                  <label htmlFor="label" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    Display Label
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
                  <small className="form-text text-muted">Visible to the end users.</small>
                </div>

                <div className="col-md-4">
                  <label htmlFor="type" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                    Data Type <span className="text-danger">*</span>
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
                      {formData.type === 'relation' ? 'Target Module' :
                        ['select', 'multiselect'].includes(formData.type) ? 'Options (JSON Array)' :
                          formData.type === 'file' ? 'Allowed Extensions (JSON Array)' :
                            ['textarea', 'richtext', 'image'].includes(formData.type) ? 'Configuration (JSON)' : 'Options'}
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
                    Display Rank
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
                      Mandatory
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mt-5 pt-4 border-top">
                <button type="submit" className="btn btn-primary px-4">
                  <span>✓</span> Add to Schema
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
                  Discard Changes
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
            Schema Attributes
            <span className="badge bg-light text-primary border ms-2 px-3 rounded-pill fw-normal">{fields.length}</span>
          </h5>
          <button
            className="btn btn-outline-primary btn-sm rounded-pill px-3"
            onClick={() => navigate(`/modules/${moduleId}/records`)}
          >
            📋 Manage Data
          </button>
        </div>
        <div className="card-body p-0">
          {fields.length === 0 ? (
            <div className="text-center py-5">
              <div className="fs-1 mb-3 opacity-25">📐</div>
              <h5 className="text-muted">No fields defined yet.</h5>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '80px' }}>Order</th>
                    <th>Name</th>
                    <th>Label</th>
                    <th>Type</th>
                    <th>Options</th>
                    <th>Required</th>
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
                          <span className="badge bg-danger">Required</span>
                        ) : (
                          <span className="badge bg-secondary">Optional</span>
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

