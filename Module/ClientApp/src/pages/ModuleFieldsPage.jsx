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
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <button
            className="btn btn-link mb-2 p-0 text-decoration-none"
            onClick={() => navigate('/')}
          >
            ← Back to Modules
          </button>
          <h1 className="mb-0">Fields for: {module.name}</h1>
          <p className="text-muted mb-0">Define the structure of your module</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <span>✕</span> Cancel
            </>
          ) : (
            <>
              <span>+</span> Add New Field
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card mb-4 shadow-sm">
          <div className="card-header bg-primary text-white">
            <h5 className="card-title mb-0">Add New Field</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label htmlFor="name" className="form-label fw-bold">
                    Field Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g., firstName"
                    required
                    autoFocus
                  />
                  <small className="form-text text-muted">Internal field identifier</small>
                </div>
                <div className="col-md-6 mb-3">
                  <label htmlFor="label" className="form-label fw-bold">
                    Label
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    id="label"
                    name="label"
                    value={formData.label}
                    onChange={handleInputChange}
                    placeholder="e.g., First Name"
                  />
                  <small className="form-text text-muted">Display name (optional)</small>
                </div>
              </div>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label htmlFor="type" className="form-label fw-bold">
                    Type <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select"
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
                  <div className="col-md-8 mb-3">
                    <label htmlFor="options" className="form-label fw-bold">
                      {formData.type === 'relation' ? 'Target Module' :
                        ['select', 'multiselect'].includes(formData.type) ? 'Options (JSON Array)' :
                          formData.type === 'file' ? 'Allowed Extensions (JSON Array)' :
                            ['textarea', 'richtext', 'image'].includes(formData.type) ? 'Configuration (JSON)' : 'Options'}
                      <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
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
                    <small className="form-text text-muted">
                      {formData.type === 'relation' ? 'Name of the module to link to' :
                        ['select', 'multiselect'].includes(formData.type) ? 'A JSON array: ["A", "B"]' :
                          formData.type === 'file' ? 'Allowed extensions: [".jpg", ".png"]' :
                            formData.type === 'textarea' || formData.type === 'richtext' ? 'JSON object with maxLength' :
                              formData.type === 'image' ? 'JSON object with maxSizeKB' : ''}
                    </small>
                  </div>
                )}
                <div className="col-md-4 mb-3">
                  <label htmlFor="orderNo" className="form-label fw-bold">
                    Order No
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    id="orderNo"
                    name="orderNo"
                    value={formData.orderNo}
                    onChange={handleInputChange}
                    min="0"
                  />
                  <small className="form-text text-muted">Display order</small>
                </div>
                <div className="col-md-4 mb-3 d-flex align-items-end">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="required"
                      name="required"
                      checked={formData.required}
                      onChange={handleInputChange}
                    />
                    <label className="form-check-label fw-bold" htmlFor="required">
                      Required Field
                    </label>
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  <span>✓</span> Add Field
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
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
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-header bg-light d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <span>📋</span> Fields ({fields.length})
          </h5>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={() => navigate(`/modules/${moduleId}/records`)}
          >
            📋 View Records
          </button>
        </div>
        <div className="card-body">
          {fields.length === 0 ? (
            <div className="alert alert-info shadow-sm">
              <h6 className="alert-heading">No fields yet</h6>
              <p className="mb-0">Add your first field to start building your module structure.</p>
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

