import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getApiConfigs, createApiConfig, updateApiConfig, deleteApiConfig, generateAiApiConfig } from '../services/api';

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
            {showAiModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content shadow-lg border-0">
                            <div className="modal-header border-bottom-0">
                                <h5 className="modal-title fw-bold">{t('ai_api_config_title')}</h5>
                                <button type="button" className="btn-close" onClick={() => setShowAiModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-muted small mb-3">
                                    {t('ai_api_config_prompt_desc')}
                                </p>
                                <textarea
                                    className="form-control"
                                    rows="4"
                                    placeholder={t('ai_api_config_prompt_placeholder')}
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    disabled={aiLoading}
                                />
                            </div>
                            <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
                                <button
                                    type="button"
                                    className="btn btn-light"
                                    onClick={() => setShowAiModal(false)}
                                    disabled={aiLoading}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary px-4"
                                    onClick={handleAiGenerate}
                                    disabled={aiLoading || !aiPrompt.trim()}
                                >
                                    {aiLoading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                            {t('ai_api_config_generating')}
                                        </>
                                    ) : (
                                        t('ai_api_config_generate')
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="card shadow mb-4 border-0">
                    <div className={`card-header ${editConfigId ? 'bg-primary' : 'bg-dark'} text-white border-0 py-3`}>
                        <h5 className="mb-0">{editConfigId ? t('edit_api_config') : t('new_api_config')}</h5>
                    </div>
                    <div className="card-body bg-light">
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
                        <div className="text-center py-5 bg-light rounded-3 border mt-3">
                            <span className="display-1 text-muted opacity-25">🔌</span>
                            <p className="mt-3 text-muted">{t('no_api_configs_found')} {module?.name}.</p>
                        </div>
                    </div>
                ) : (
                    configs.map(config => (
                        <div key={config.id} className="col-md-6">
                            <div className="card h-100 shadow-sm border-0">
                                <div className="card-header bg-white border-0 pt-3 d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className={`badge bg-${config.method === 'GET' ? 'success' : 'primary'} mb-2`}>{config.method}</span>
                                        <h5 className="mb-0">{config.name}</h5>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-outline-primary btn-sm border-0" onClick={() => handleEdit(config)} title={t('edit_api_config')}>
                                            <span>📝 {t('edit_api_config')}</span>
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm border-0" onClick={() => handleDelete(config.id)} title={t('delete_api_config')}>
                                            <span>🗑️</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="bg-light p-2 rounded mb-3">
                                        <code className="small text-break">{config.url}</code>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <div className="border rounded p-2 text-center h-100 bg-white">
                                                <div className="small text-muted mb-1">{t('headers')}</div>
                                                <div className="fw-bold">{config.headersJson ? `${t('yes')} ✅` : t('no')}</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="border rounded p-2 text-center h-100 bg-white">
                                                <div className="small text-muted mb-1">{t('mappings')}</div>
                                                <div className="fw-bold">{config.responseMappingsJson ? `${t('yes')} ✅` : t('no')}</div>
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
