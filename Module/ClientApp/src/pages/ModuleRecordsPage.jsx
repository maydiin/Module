import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModule, getFields, getRecords, createRecord, updateRecord, deleteRecord } from '../services/api';
import DynamicForm from '../components/DynamicForm';
import LinkedRecordsModal from '../components/LinkedRecordsModal';

function ModuleRecordsPage() {
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
  const [linkedCountLoading, setLinkedCountLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [moduleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [moduleData, fieldsData, recordsData] = await Promise.all([
        getModule(moduleId),
        getFields(moduleId),
        getRecords(moduleId)
      ]);
      setModule(moduleData);
      setFields(fieldsData);
      setRecords(recordsData);
    } catch (err) {
      if (err.response?.status === 404) {
        setModule(null);
      } else {
        setError(err.response?.data?.error || 'Failed to load data from server. Check if database is updated.');
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
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save record');
      console.error(err);
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this record?')) {
      return;
    }

    try {
      await deleteRecord(moduleId, recordId);
      loadData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete record');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingRecord(null);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Loading records...</p>
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

  if (fields.length === 0) {
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
            <h1 className="mb-0">Records for: {module.name}</h1>
            <p className="text-muted mb-0">Manage your module records</p>
          </div>
        </div>
        <div className="alert alert-warning shadow-sm">
          <h6 className="alert-heading">No fields defined</h6>
          <p className="mb-3">This module has no fields. Please add fields first before creating records.</p>
          <button
            className="btn btn-warning"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            ⚙️ Manage Fields
          </button>
        </div>
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
          <h1 className="mb-0">Records for: {module.name}</h1>
          <p className="text-muted mb-0">Create and manage your module records</p>
        </div>
        <div>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            ⚙️ Manage Fields
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingRecord(null);
              setShowForm(true);
            }}
            disabled={showForm}
          >
            <span>+</span> Add New Record
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card mb-4 shadow-sm">
          <div className={`card-header ${editingRecord ? 'bg-warning text-dark' : 'bg-primary text-white'}`}>
            <h5 className="card-title mb-0">
              {editingRecord ? '✏️ Edit Record' : '➕ Create New Record'}
            </h5>
          </div>
          <div className="card-body">
            <DynamicForm
              fields={fields}
              initialData={editingRecord?.data || {}}
              onSubmit={handleFormSubmit}
              submitLabel={editingRecord ? 'Update Record' : 'Create Record'}
            />
            <button
              className="btn btn-secondary mt-2"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card shadow-sm">
        <div className="card-header bg-light">
          <h5 className="mb-0">
            <span>📋</span> Records ({records.length})
          </h5>
        </div>
        <div className="card-body">
          {records.length === 0 ? (
            <div className="alert alert-info shadow-sm">
              <h6 className="alert-heading">No records yet</h6>
              <p className="mb-0">Create your first record using the form above.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th style={{ width: '120px' }}>Linked Count</th>
                    {fields.map(field => (
                      <th key={field.id}>{field.label}</th>
                    ))}
                    <th style={{ width: '180px' }}>Created At</th>
                    <th style={{ width: '150px' }}>Actions</th>
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
                          title={record.linkedCount > 0 ? 'View linked records' : 'No linked records'}
                        >
                          📎 {record.linkedCount || 0}
                        </button>
                      </td>
                      {fields.map(field => (
                        <td key={field.id}>
                          {field.type === 'checkbox' ? (
                            record.data[field.name] ? (
                              <span className="badge bg-success">✓ Yes</span>
                            ) : (
                              <span className="badge bg-secondary">✗ No</span>
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
                            title="Edit record"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleDelete(record.id)}
                            disabled={showForm}
                            title="Delete record"
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

