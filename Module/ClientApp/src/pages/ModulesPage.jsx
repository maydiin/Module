import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules, createModule, updateModule, refreshToken, generateAiConfig, applyAiConfig } from '../services/api';
import HasPermission from '../components/HasPermission';
import { useTenant } from '../components/TenantContext';

function ModulesPage() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [moduleName, setModuleName] = useState('');
  const [auditCreate, setAuditCreate] = useState(true);
  const [auditUpdate, setAuditUpdate] = useState(true);
  const [auditDelete, setAuditDelete] = useState(true);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
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
      let result;
      const payload = {
        name: moduleName.trim(),
        auditCreate,
        auditUpdate,
        auditDelete
      };

      if (editingModuleId) {
        result = await updateModule(editingModuleId, payload);
      } else {
        result = await createModule(payload);
      }

      // If permissions were added/renamed (triggering refresh token need), refresh it
      // Note: UpdateModule currently doesn't return shouldRefreshToken but we might want to reload if name changed
      if (result.shouldRefreshToken) {
        await refreshToken();
        window.location.reload();
      } else {
        resetForm();
        loadModules();
        if (editingModuleId) {
          // If name changed, we really should reload to update permissions in local storage if we want strictly correct state
          // But for now let's just reload modules.
          // Actually, if name changed, permissions changed, so we MUST reload to get new token or at least refresh it.
          // The backend UpdateModule doesn't check for own-role update yet, but renaming affects everyone.
          // Let's force a reload if we edited.
          window.location.reload();
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || t('error'));
      console.error(err);
    }
  };

  const resetForm = () => {
    setModuleName('');
    setAuditCreate(true);
    setAuditUpdate(true);
    setAuditDelete(true);
    setEditingModuleId(null);
    setShowForm(false);
  };

  const handleEditClick = (module) => {
    setEditingModuleId(module.id);
    setModuleName(module.name);
    setAuditCreate(module.auditCreate);
    setAuditUpdate(module.auditUpdate);
    setAuditDelete(module.auditDelete);
    setShowForm(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary btn-lg px-4 shadow-sm"
            onClick={() => setShowAiModal(true)}
          >
            {t('ai_architect_btn')}
          </button>

          {/* Dynamic creation button usually requires high-level manage permission */}
          {isSuperAdmin || userPermissions.includes('Schema.Manage') || userPermissions.some(p => p.endsWith('.Manage')) ? (
            <button
              className={`btn ${showForm ? 'btn-outline-danger' : 'btn-primary'} btn-lg px-4 shadow-sm`}
              onClick={() => {
                if (showForm) resetForm();
                else setShowForm(true);
              }}
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
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-lg border-0 mb-5 overflow-hidden">
          <div className="card-header bg-primary py-3">
            <h5 className="card-title mb-0 text-white">
              {editingModuleId ? t('edit_module') : t('new_module_blueprint')}
            </h5>
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

              <div className="mb-4">
                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-3">
                  {t('audit_configuration')}
                </label>
                <div className="d-flex gap-4">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="auditCreate"
                      checked={auditCreate}
                      onChange={(e) => setAuditCreate(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="auditCreate">
                      {t('log_create')}
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="auditUpdate"
                      checked={auditUpdate}
                      onChange={(e) => setAuditUpdate(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="auditUpdate">
                      {t('log_update')}
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="auditDelete"
                      checked={auditDelete}
                      onChange={(e) => setAuditDelete(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="auditDelete">
                      {t('log_delete')}
                    </label>
                  </div>
                </div>
              </div>
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary px-4">
                  <span>✓</span> {editingModuleId ? t('update') : t('finalize_module')}
                </button>
                <button
                  type="button"
                  className="btn btn-link text-muted text-decoration-none"
                  onClick={resetForm}
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
                      <button
                        className="btn btn-light btn-sm flex-grow-1 border"
                        onClick={() => handleEditClick(module)}
                      >
                        <span className="opacity-75">✏️</span> {t('edit')}
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
                    <HasPermission permission={`Module.${module.name}.Script`}>
                      <button
                        className="btn btn-light btn-sm flex-grow-1 border"
                        onClick={() => navigate(`/modules/${module.id}/scripts`)}
                      >
                        <span className="opacity-75">📜</span> Scripts
                      </button>
                    </HasPermission>
                  </div>
                </div>
              </div>
            </div>
          ))
          }
        </div >
      )
      }

      {/* AI Modal */}
      {showAiModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title">{t('ai_architect_modal_title')}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAiModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                {!aiPreview ? (
                  <>
                    <div className="mb-3">
                      <label htmlFor="aiPrompt" className="form-label lead">{t('ai_prompt_label')}</label>
                      <textarea
                        className="form-control form-control-lg"
                        id="aiPrompt"
                        rows="5"
                        placeholder={t('ai_prompt_placeholder')}
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        disabled={aiLoading}
                      ></textarea>
                    </div>
                    {aiLoading && (
                      <div className="text-center py-3">
                        <div className="spinner-border text-primary mb-2" role="status"></div>
                        <p className="text-muted">{t('ai_analyzing')}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="mb-3">
                    <div className="alert alert-success">
                      <h6 className="alert-heading">{t('ai_config_generated')}</h6>
                      <p className="mb-0">{t('ai_review_msg')}</p>
                    </div>
                    <div className="bg-light p-3 rounded border" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <pre className="mb-0 small">
                        {JSON.stringify(aiPreview, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-link text-muted text-decoration-none" onClick={() => setShowAiModal(false)} disabled={aiLoading}>
                  {t('cancel')}
                </button>
                {!aiPreview ? (
                  <button
                    type="button"
                    className="btn btn-primary px-4"
                    onClick={async () => {
                      if (!aiPrompt.trim()) return;
                      setAiLoading(true);
                      try {
                        const config = await generateAiConfig(aiPrompt);
                        setAiPreview(config);
                      } catch (err) {
                        alert(t('ai_generate_error') + (err.response?.data || err.message));
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    disabled={aiLoading || !aiPrompt.trim()}
                  >
                    {aiLoading ? t('ai_generating') : t('ai_generate_plan')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setAiPreview(null)}
                      disabled={aiLoading}
                    >
                      {t('ai_back_to_edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-success px-4"
                      onClick={async () => {
                        setAiLoading(true);
                        try {
                          await applyAiConfig(aiPreview);
                          setShowAiModal(false);
                          setAiPreview(null);
                          setAiPrompt('');
                          loadModules(); // Refresh modules
                          alert(t('ai_success_msg'));
                        } catch (err) {
                          alert(t('ai_apply_error') + (err.response?.data || err.message));
                        } finally {
                          setAiLoading(false);
                        }
                      }}
                      disabled={aiLoading}
                    >
                      {aiLoading ? t('ai_applying') : t('ai_apply_changes')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}

export default ModulesPage;

