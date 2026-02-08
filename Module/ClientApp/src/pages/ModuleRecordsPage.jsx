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
            <span className="opacity-50 me-2">📋</span>
            {module.name} Records
          </h1>
          <p className="text-muted mb-0">Navigate and manage the data instances of this module.</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary border-2 px-4 shadow-sm"
            onClick={() => navigate(`/modules/${moduleId}/fields`)}
          >
            ⚙️ Schema
          </button>
          <button
            className="btn btn-primary px-4 shadow-sm"
            onClick={() => {
              setEditingRecord(null);
              setShowForm(true);
            }}
            disabled={showForm}
          >
            <span>+</span> New Entry
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
              {editingRecord ? '✏️ Update Existing Record' : '➕ Forge New Record'}
            </h5>
          </div>
          <div className="card-body p-4">
            <DynamicForm
              fields={fields}
              initialData={editingRecord?.data || {}}
              onSubmit={handleFormSubmit}
              submitLabel={editingRecord ? 'Save Changes' : 'Initialize Record'}
            />
            <button
              className="btn btn-link text-muted mt-3 text-decoration-none"
              onClick={handleCancel}
            >
              Discard Actions
            </button>
          </div>
        </div>
      )}

      <div className="card shadow-soft border-0 overflow-hidden">
        <div className="card-header bg-white py-4 px-4 border-bottom">
          <h5 className="mb-0 fw-bold">
            <span className="opacity-75 me-2">📁</span>
            Data Inventory
            <span className="badge bg-light text-primary border ms-2 px-3 rounded-pill fw-normal">{records.length}</span>
          </h5>
        </div>
        <div className="card-body p-0">
          {records.length === 0 ? (
            <div className="text-center py-5">
              <div className="fs-1 mb-3 opacity-25">📂</div>
              <h5 className="text-muted">Inventory is currently empty.</h5>
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

