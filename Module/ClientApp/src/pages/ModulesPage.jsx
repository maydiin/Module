import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules, createModule, refreshToken } from '../services/api';
import HasPermission from '../components/HasPermission';
import { useTenant } from '../components/TenantContext';

function ModulesPage() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { selectedTenantId } = useTenant();

  useEffect(() => {
    loadModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      const data = await getModules();
      setModules(data);
    } catch (err) {
      setError(t('error'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!moduleName.trim()) {
      setError(t('required'));
      return;
    }

    try {
      const result = await createModule({ name: moduleName.trim() });

      // If permissions were added to a role the current user has, refresh their token
      if (result.shouldRefreshToken) {
        await refreshToken();
        window.location.reload();
      } else {
        setModuleName('');
        setShowForm(false);
        loadModules();
      }
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
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
          <span className="visually-hidden">{t('loading')}</span>
        </div>
        <p className="mt-2 text-muted">{t('loading')}</p>
      </div>
    );
  }

  // Filter modules based on View permission (Super Admin sees all)
  const permissionsJson = localStorage.getItem('permissions');
  const userPermissions = permissionsJson ? JSON.parse(permissionsJson) : [];
  const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';

  const visibleModules = isSuperAdmin
    ? modules
    : modules.filter(m => userPermissions.includes(`Module.${m.name}.View`));

  return (
    <div className="fade-in">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
        <div>
          <h1 className="display-5 mb-1">{t('modules_title')}</h1>
          <p className="text-muted lead mb-0">{t('modules_subtitle')}</p>
        </div>

        {/* Dynamic creation button usually requires high-level manage permission */}
        {isSuperAdmin || userPermissions.includes('Schema.Manage') || userPermissions.some(p => p.endsWith('.Manage')) ? (
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
                <span className="fs-5">+</span> {t('create_module')}
              </>
            )}
          </button>
        ) : null}
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-lg border-0 mb-5 overflow-hidden">
          <div className="card-header bg-primary py-3">
            <h5 className="card-title mb-0 text-white">{t('new_module_blueprint')}</h5>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="moduleName" className="form-label small fw-bold text-uppercase tracking-wider text-muted">
                  {t('module_identifier')}
                </label>
                <input
                  type="text"
                  className="form-control form-control-lg border-2"
                  id="moduleName"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder={t('module_placeholder')}
                  autoFocus
                />
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary px-4">
                  <span>✓</span> {t('finalize_module')}
                </button>
                <button
                  type="button"
                  className="btn btn-link text-muted text-decoration-none"
                  onClick={() => {
                    setShowForm(false);
                    setModuleName('');
                  }}
                >
                  {t('discard')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {visibleModules.length === 0 ? (
        <div className="text-center py-5 glass rounded-4 border-dashed border-2">
          <div className="fs-1 mb-3 opacity-50">📁</div>
          <h3 className="h4">{t('empty_workspace_title')}</h3>
          <p className="text-muted">{t('empty_workspace_desc')}</p>
        </div>
      ) : (
        <div className="row g-4">
          {visibleModules.map((module) => (
            <div key={module.id} className="col-lg-4 col-md-6">
              <div className="card h-100 border-0 shadow-soft-hover">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-4">
                    <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-3 me-3">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                        <line x1="12" y1="22.08" x2="12" y2="12"></line>
                      </svg>
                    </div>
                    <div>
                      <h5 className="card-title mb-1 fw-bold">{module.name}</h5>
                      <div className="badge bg-light text-muted fw-normal border">ID: {module.id}</div>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mt-auto">
                    <HasPermission permission={`Module.${module.name}.Manage`}>
                      <button
                        className="btn btn-light btn-sm flex-grow-1 border"
                        onClick={() => handleModuleClick(module.id)}
                      >
                        <span className="opacity-75">⚙️</span> {t('fields')}
                      </button>
                    </HasPermission>
                    <HasPermission permission={`Module.${module.name}.View`}>
                      <button
                        className="btn btn-light btn-sm flex-grow-1 border"
                        onClick={() => navigate(`/modules/${module.id}/records`)}
                      >
                        <span className="opacity-75">📋</span> {t('records')}
                      </button>
                    </HasPermission>
                    <HasPermission permission={`Module.${module.name}.Api`}>
                      <button
                        className="btn btn-light btn-sm flex-grow-1 border"
                        onClick={() => navigate(`/modules/${module.id}/api-configs`)}
                      >
                        <span className="opacity-75">🔌</span> API
                      </button>
                    </HasPermission>
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

