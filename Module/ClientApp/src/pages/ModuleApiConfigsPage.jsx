import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getApiConfigs, createApiConfig, updateApiConfig, deleteApiConfig, generateAiApiConfig, executeApiSync } from '../services/api';
import AiChatModal from '../components/AiChatModal';

function ModuleApiConfigsPage() {
    const { t } = useTranslation();
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [module, setModule] = useState(null);
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editConfigId, setEditConfigId] = useState(null);
    const [error, setError] = useState('');
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [executingConfigs, setExecutingConfigs] = useState({});

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        method: 'POST',
        headersJson: '',
        requestBodyTemplate: '',
        responseMappingsJson: ''
    });

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [moduleData, configsData] = await Promise.all([
                getModule(moduleId),
                getApiConfigs(moduleId)
            ]);
            setModule(moduleData);
            setConfigs(configsData);
        } catch (err) {
            setError(t('error'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (config) => {
        setEditConfigId(config.id);
        setFormData({
            name: config.name,
            url: config.url,
            method: config.method,
            headersJson: config.headersJson || '',
            requestBodyTemplate: config.requestBodyTemplate || '',
            responseMappingsJson: config.responseMappingsJson || ''
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name || !formData.url) {
            setError(t('required'));
            return;
        }

        try {
            if (editConfigId) {
                await updateApiConfig(moduleId, editConfigId, formData);
            } else {
                await createApiConfig(moduleId, formData);
            }
            resetForm();
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
            console.error(err);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            url: '',
            method: 'POST',
            headersJson: '',
            requestBodyTemplate: '',
            responseMappingsJson: ''
        });
        setEditConfigId(null);
        setShowForm(false);
    };

    const handleDelete = async (configId) => {
        if (!window.confirm(t('confirm_delete_config'))) return;
        try {
            await deleteApiConfig(moduleId, configId);
            loadData();
        } catch (err) {
            setError(t('error'));
            console.error(err);
        }
    };

    const handleExecute = async (configId) => {
        try {
            setExecutingConfigs(prev => ({ ...prev, [configId]: true }));
            const result = await executeApiSync(configId);
            alert(t('sync_success', { message: result.message }));
        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.error || err.response?.data || err.message;
            alert(t('sync_failed', { error: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg) }));
        } finally {
            setExecutingConfigs(prev => ({ ...prev, [configId]: false }));
        }
    };

    const handleAiGenerate = async () => {
        try {
            setAiLoading(true);
            const config = await generateAiApiConfig(moduleId, aiPrompt);

            if (config.apiConfigs && config.apiConfigs.length > 0) {
                const generated = config.apiConfigs[0];
                setEditConfigId(null);
                setFormData({
                    name: generated.name || '',
                    url: generated.url || '',
                    method: generated.method || 'POST',
                    headersJson: generated.headersJson || '',
                    requestBodyTemplate: generated.requestBodyTemplate || '',
                    responseMappingsJson: generated.responseMappingsJson || ''
                });
                setShowAiModal(false);
                setAiPrompt('');
                setShowForm(true);
            } else {
                alert(t('ai_api_config_no_result'));
            }
        } catch (err) {
            console.error(err);
            alert(t('ai_api_config_failed') + ': ' + (err.response?.data?.error || err.message));
        } finally {
            setAiLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">{t('loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to="/">{t('modules')}</Link></li>
                    <li className="breadcrumb-item active">{module?.name} {t('api_configs')}</li>
                </ol>
            </nav>

            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-0">{t('api_configs_title')}</h1>
                    <p className="text-muted">{t('api_configs_subtitle')} {module?.name}</p>
                </div>
                <div className="d-flex gap-2">
                    <button
                        onClick={() => setShowAiModal(true)}
                        className="btn btn-outline-info px-3 shadow-sm"
                        title={t('ai_api_config_btn')}
                    >
                        <span className="me-1">✨</span> AI Config
                    </button>
                    <button
                        className={`btn ${showForm ? 'btn-outline-danger' : 'btn-primary'}`}
                        onClick={() => {
                            if (showForm) resetForm();
                            else setShowForm(true);
                        }}
                    >
                        {showForm ? t('cancel') : `+ ${t('add_new_config')}`}
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* AI Generation Modal */}
            <AiChatModal
                show={showAiModal}
                onClose={() => setShowAiModal(false)}
                generateAi={(prompt, history) => generateAiApiConfig(moduleId, prompt, history)}
                onApply={(config) => {
                    const configsList = config.ApiConfigs || config.apiConfigs;
                    if (configsList && configsList.length > 0) {
                        const generated = configsList[0];
                        setEditConfigId(null);
                        setFormData({
                            name: generated.Name || generated.name || '',
                            url: generated.Url || generated.url || '',
                            method: generated.Method || generated.method || 'POST',
                            headersJson: generated.HeadersJson || generated.headersJson || '',
                            requestBodyTemplate: generated.RequestBodyTemplate || generated.requestBodyTemplate || '',
                            responseMappingsJson: generated.ResponseMappingsJson || generated.responseMappingsJson || ''
                        });
                        setShowAiModal(false);
                        setShowForm(true);
                    } else {
                        alert(t('ai_api_config_no_result'));
                    }
                }}
                title={t('ai_api_config_title')}
                placeholder={t('ai_api_config_prompt_placeholder')}
            />

            {showForm && (
                <div className="card glass-card shadow-premium mb-4 border-0 overflow-hidden fade-in">
                    <div className={`card-header ${editConfigId ? 'bg-primary bg-opacity-20' : 'bg-surface bg-opacity-40'} border-bottom border-theme-accent py-3`}>
                        <h5 className="mb-0 fw-bold">{editConfigId ? t('edit_api_config') : t('new_api_config')}</h5>
                    </div>
                    <div className="card-body bg-muted bg-opacity-10">
                        <form onSubmit={handleSubmit}>
                            <div className="row">
                                <div className="col-md-8 mb-3">
                                    <label className="form-label fw-bold">{t('integration_name')}</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder={t('integration_name_placeholder')}
                                    />
                                </div>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label fw-bold">{t('http_method')}</label>
                                    <select
                                        className="form-select"
                                        value={formData.method}
                                        onChange={e => setFormData({ ...formData, method: e.target.value })}
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label fw-bold">{t('api_url')}</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    placeholder={t('api_url_placeholder')}
                                />
                                <small className="text-muted">{t('dynamic_placeholders_help')}</small>
                            </div>

                            <div className="mb-3">
                                <label className="form-label fw-bold">{t('custom_headers')}</label>
                                <textarea
                                    className="form-control font-monospace"
                                    rows="2"
                                    value={formData.headersJson}
                                    onChange={e => setFormData({ ...formData, headersJson: e.target.value })}
                                    placeholder={t('custom_headers_placeholder')}
                                ></textarea>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-bold">{t('request_body_template')}</label>
                                    <textarea
                                        className="form-control font-monospace"
                                        rows="4"
                                        value={formData.requestBodyTemplate}
                                        onChange={e => setFormData({ ...formData, requestBodyTemplate: e.target.value })}
                                        placeholder={t('request_body_placeholder')}
                                    ></textarea>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-bold">{t('response_mappings')}</label>
                                    <textarea
                                        className="form-control font-monospace"
                                        rows="4"
                                        value={formData.responseMappingsJson}
                                        onChange={e => setFormData({ ...formData, responseMappingsJson: e.target.value })}
                                        placeholder={t('response_mappings_placeholder')}
                                    ></textarea>
                                    <small className="text-muted">{t('map_api_paths_help')}</small>
                                </div>
                            </div>

                            <div className="d-flex justify-content-end gap-2 mt-2">
                                <button type="button" className="btn btn-outline-secondary px-4" onClick={resetForm}>{t('cancel')}</button>
                                <button type="submit" className="btn btn-primary px-5 fw-bold">{editConfigId ? t('update_configuration') : t('save_configuration')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {configs.length === 0 ? (
                    <div className="col-12">
                        <div className="text-center py-5 bg-surface bg-opacity-20 rounded-4 border border-theme-accent border-dashed mt-3">
                            <span className="display-1 opacity-25">🔌</span>
                            <p className="mt-3 text-muted">{t('no_api_configs_found')} {module?.name}.</p>
                        </div>
                    </div>
                ) : (
                    configs.map(config => (
                        <div key={config.id} className="col-md-6">
                            <div className="card glass-card h-100 shadow-premium border-0 overflow-hidden">
                                <div className="card-header bg-surface bg-opacity-40 border-bottom border-theme-accent py-3 d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className={`badge bg-${config.method === 'GET' ? 'success' : 'primary'} mb-2`}>{config.method}</span>
                                        <h5 className="mb-0">{config.name}</h5>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button 
                                            className="btn btn-outline-success btn-sm border-0" 
                                            onClick={() => handleExecute(config.id)} 
                                            disabled={executingConfigs[config.id]}
                                            title={t('execute')}
                                        >
                                            {executingConfigs[config.id] ? (
                                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                            ) : (
                                                <span className="me-1">🚀</span>
                                            )}
                                            {t('execute')}
                                        </button>
                                        <button className="btn btn-outline-primary btn-sm border-0" onClick={() => handleEdit(config)} title={t('edit_api_config')}>
                                            <span>📝 {t('edit_api_config')}</span>
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm border-0" onClick={() => handleDelete(config.id)} title={t('delete_api_config')}>
                                            <span>🗑️</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="bg-muted bg-opacity-30 p-2 rounded mb-3 border border-theme-accent">
                                        <code className="small text-break text-primary">{config.url}</code>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <div className="border border-theme-accent rounded p-2 text-center h-100 bg-surface bg-opacity-20">
                                                <div className="small text-muted mb-1">{t('headers')}</div>
                                                <div className="fw-bold text-foreground">{config.headersJson ? `${t('yes')} ✅` : t('no')}</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="border border-theme-accent rounded p-2 text-center h-100 bg-surface bg-opacity-20">
                                                <div className="small text-muted mb-1">{t('mappings')}</div>
                                                <div className="fw-bold text-foreground">{config.responseMappingsJson ? `${t('yes')} ✅` : t('no')}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {config.requestBodyTemplate && (
                                        <div className="small mb-2">
                                            <div className="fw-bold mb-1">{t('body_template')}</div>
                                            <pre className="bg-dark text-light p-2 rounded small overflow-auto" style={{ maxHeight: '100px' }}>
                                                {config.requestBodyTemplate}
                                            </pre>
                                        </div>
                                    )}

                                    {config.responseMappingsJson && (
                                        <div className="small">
                                            <div className="fw-bold mb-1">{t('mappings')}:</div>
                                            <pre className="bg-light border p-2 rounded small overflow-auto" style={{ maxHeight: '100px' }}>
                                                {config.responseMappingsJson}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ModuleApiConfigsPage;
