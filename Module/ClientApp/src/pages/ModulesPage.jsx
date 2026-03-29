import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules, getModuleSummaries, createModule, updateModule, refreshToken, generateAiConfig, applyAiConfig } from '../services/api';
import HasPermission from '../components/HasPermission';
import { useTenant } from '../components/TenantContext';
import { useAuth } from '../components/AuthContext';
import AiChatModal from '../components/AiChatModal';

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
  const [viewMode] = useState('summaries');
  const [summaries, setSummaries] = useState([]);
  const [collapsedModules, setCollapsedModules] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('collapsedModules')) || [];
    } catch {
      return [];
    }
  });
  const navigate = useNavigate();
  const { selectedTenantId } = useTenant();
  const { permissions: userPermissions, isSuperAdmin, hasPermission } = useAuth();


  useEffect(() => {
    loadModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      if (viewMode === 'summaries') {
        const data = await getModuleSummaries();
        setSummaries(data);
        // Also update regular modules list for creation/permission logic
        setModules(data.map(s => ({ id: s.moduleId, name: s.moduleName })));
      } else {
        const data = await getModules();
        setModules(data);
      }
    } catch (err) {
      setError(t('error'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('collapsedModules', JSON.stringify(collapsedModules));
  }, [collapsedModules]);

  const toggleModuleCollapse = (moduleId) => {
    setCollapsedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
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



  const visibleModules = isSuperAdmin
    ? modules
    : modules.filter(m => hasPermission(`Module.${m.name}.View`));

  return (
    <div className="fade-in">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3 fade-in">
        <div className="d-flex align-items-center">
          <div className="bg-primary bg-opacity-10 text-primary rounded-4 p-3 me-4 shadow-sm">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div>
            <h1 className="display-5 mb-1 fw-800">
              <span className="text-gradient">
                {t('modules')}
              </span>
            </h1>
            <p className="text-muted mb-0 lead fw-medium opacity-70" style={{ fontSize: '1rem' }}>{t('manage_blueprints_desc')}</p>
          </div>
        </div>
        <div className="d-flex gap-3 flex-wrap">
          <button
            className="btn btn-secondary bg-white bg-opacity-50 text-dark border-0 shadow-premium hover-lift px-4"
            onClick={() => setShowAiModal(true)}
            style={{ backdropFilter: 'blur(10px)' }}
          >
            <span className="me-2">✨</span> {t('ai_architect') || 'AI Architect'}
          </button>
          <button
            className="btn btn-primary px-4 shadow-premium hover-lift"
            onClick={() => {
              setEditingModuleId(null);
              setModuleName('');
              setShowForm(true);
            }}
            disabled={showForm}
          >
            <span className="me-2 fs-5">+</span> {t('new_module')}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger glass border-danger border-opacity-25 shadow-premium mb-4" role="alert">
          {error}
        </div>
      )}

      {showForm && (
        <div className="card shadow-premium border-0 mb-5 overflow-hidden fade-in">
          <div className="card-header bg-gradient-to-r from-primary to-secondary py-3 border-0">
            <h5 className="card-title mb-0 text-white fw-bold">
              {editingModuleId ? t('edit_module') : t('new_module_blueprint')}
            </h5>
          </div>
          <div className="card-body p-4 p-lg-5">
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

      {modules.length === 0 ? (
        <div className="text-center py-5 glass-card border-0 stagger-in">
          <div className="display-1 mb-4 opacity-10">🧩</div>
          <h3 className="text-muted fw-bold">{t('no_modules_yet')}</h3>
          <p className="text-muted mb-4">{t('start_by_creating')}</p>
          <button
            className="btn btn-primary px-5 shadow-lg"
            onClick={() => setShowForm(true)}
          >
            {t('create_first_blueprint')}
          </button>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4 stagger-in">
          {summaries.map((summary) => {
            const isCollapsed = collapsedModules.includes(summary.moduleId);
            const displayCols = summary.fields.filter(f => f.isDisplayField).length > 0
              ? summary.fields.filter(f => f.isDisplayField)
              : summary.fields.slice(0, 3);

            return (
              <div key={summary.moduleId} className="glass-card border-0 overflow-hidden">
                <div
                  className="card-header bg-white bg-opacity-30 py-4 px-4 d-flex justify-content-between align-items-center transition-all hover-bg-light"
                  style={{ cursor: 'pointer', border: 'none' }}
                  onClick={() => toggleModuleCollapse(summary.moduleId)}
                >
                  <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 text-primary rounded-3 p-2 me-3 shadow-sm border border-primary border-opacity-10">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </div>
                    <div>
                      <h4 className="mb-0 fw-800 fs-5">{summary.moduleName}</h4>
                      <span className="text-muted fw-bold opacity-60" style={{ fontSize: '0.75rem', letterSpacing: '0.02em' }}>
                        {summary.latestRecords.length} {t('entries') || 'Kayıt'}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <button
                      className="btn btn-primary btn-sm rounded-pill px-4 shadow-md transition-all hover-lift fw-bold"
                      style={{ fontSize: '0.8rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/modules/${summary.moduleId}/records`);
                      }}
                    >
                      {t('open_module') || 'Modülü Aç'}
                    </button>
                    <span className={`transition-all ${isCollapsed ? '' : 'rotate-180'} d-flex opacity-50`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </span>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="card-body p-0 border-top border-white border-opacity-20 fade-in">
                    {summary.latestRecords.length === 0 ? (
                      <div className="p-5 text-center text-muted small fw-medium">
                        <div className="fs-2 mb-2 opacity-10">📄</div>
                        {t('no_records_found')}
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                          <thead>
                            <tr>
                              {displayCols.map(col => (
                                <th key={col.id} className="px-4 py-3">{col.label || col.name}</th>
                              ))}
                              <th className="px-4 py-3 text-end" style={{ width: '100px' }}>{t('actions')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.latestRecords.map(record => (
                              <tr key={record.id} className="cursor-pointer" onClick={() => navigate(`/modules/${summary.moduleId}/records/${record.id}`)}>
                                {displayCols.map(col => (
                                  <td key={col.id} className="px-4 py-3 text-truncate fw-medium" style={{ maxWidth: '250px' }}>
                                    {record.data[col.name] !== undefined ? String(record.data[col.name]) : <span className="opacity-25">-</span>}
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-end">
                                  <span className="text-primary fw-bold small">Detay →</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AI Modal */}
      <AiChatModal
        show={showAiModal}
        onClose={() => setShowAiModal(false)}
        generateAi={generateAiConfig}
        onApply={async (config) => {
          try {
            await applyAiConfig(config);
            setShowAiModal(false);
            loadModules();
            alert(t('ai_success_msg'));
          } catch (err) {
            alert(t('ai_apply_error') + " " + (err.response?.data || err.message));
          }
        }}
        title={t('ai_architect_modal_title')}
        placeholder={t('ai_prompt_placeholder')}
      />
    </div >
  );
}

export default ModulesPage;

