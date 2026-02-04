import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getModules, createModule } from '../services/api';

function ModulesPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const data = await getModules();
      setModules(data);
    } catch (err) {
      setError('Failed to load modules');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!moduleName.trim()) {
      setError('Module name is required');
      return;
    }

    try {
      await createModule({ name: moduleName.trim() });
      setModuleName('');
      setShowForm(false);
      loadModules();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create module');
      console.error(err);
    }
  };

  const handleModuleClick = (moduleId) => {
    navigate(`/modules/${moduleId}/fields`);
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Loading modules...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-0">Modules</h1>
          <p className="text-muted mb-0">Manage your dynamic modules</p>
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
              <span>+</span> Add New Module
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
            <h5 className="card-title mb-0">Create New Module</h5>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="moduleName" className="form-label fw-bold">
                  Module Name
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  id="moduleName"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="Enter module name (e.g., Customers, Products)"
                  autoFocus
                />
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary">
                  <span>✓</span> Create Module
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setModuleName('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modules.length === 0 ? (
        <div className="alert alert-info shadow-sm">
          <h5 className="alert-heading">No modules yet</h5>
          <p className="mb-0">Create your first module to get started with dynamic form management.</p>
        </div>
      ) : (
        <div className="row g-3">
          {modules.map((module) => (
            <div key={module.id} className="col-md-4 col-sm-6">
              <div className="card h-100 shadow-sm border-0">
                <div className="card-body">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-primary bg-opacity-10 rounded p-2 me-2">
                      <span className="fs-4">📦</span>
                    </div>
                    <div>
                      <h5 className="card-title mb-0">{module.name}</h5>
                      <small className="text-muted">ID: {module.id}</small>
                    </div>
                  </div>
                </div>
                <div className="card-footer bg-transparent border-top">
                  <div className="d-grid gap-2 d-md-block">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleModuleClick(module.id)}
                    >
                      ⚙️ Manage Fields
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => navigate(`/modules/${module.id}/records`)}
                    >
                      📋 View Records
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ModulesPage;

