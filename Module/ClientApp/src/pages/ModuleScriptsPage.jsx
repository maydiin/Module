import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getScripts, createScript, updateScript, deleteScript, getModule, generateAiScriptConfig } from '../services/api';
import AiChatModal from '../components/AiChatModal';

const ModuleScriptsPage = () => {
    const { t } = useTranslation();
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [module, setModule] = useState(null);
    const [scripts, setScripts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingScript, setEditingScript] = useState(null);
    const [formData, setFormData] = useState({
        triggerType: 'CustomList',
        scriptContent: '',
        isActive: true
    });
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);

    const triggerTypes = [
        'CustomList',
        'BeforeCreate', 'AfterCreate',
        'BeforeUpdate', 'AfterUpdate',
        'BeforeDelete', 'AfterDelete'
    ];

    useEffect(() => {
        fetchData();
    }, [moduleId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [moduleData, scriptsData] = await Promise.all([
                getModule(moduleId),
                getScripts(moduleId)
            ]);
            setModule(moduleData);
            setScripts(scriptsData);
        } catch (err) {
            setError(t('failed_load_scripts'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (script) => {
        setEditingScript(script);
        setFormData({
            triggerType: script.triggerType,
            scriptContent: script.scriptContent,
            isActive: script.isActive
        });
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingScript(null);
        setFormData({
            triggerType: 'CustomList',
            scriptContent: '// Write your JS code here\n// Available objects: Db, Data, User, Fail(msg), Log(msg)\n',
            isActive: true
        });
        setShowModal(true);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm(t('confirm_delete_script'))) {
            try {
                await deleteScript(moduleId, id);
                fetchData();
            } catch (err) {
                alert(t('failed_delete_script'));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingScript) {
                await updateScript(moduleId, editingScript.id, formData);
            } else {
                await createScript(moduleId, formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert(t('failed_save_script') + ': ' + (err.response?.data?.error || err.message));
        }
    };

    const handleAiGenerate = async () => {
        try {
            setAiLoading(true);
            const config = await generateAiScriptConfig(moduleId, aiPrompt);

            if (config.scripts && config.scripts.length > 0) {
                const generated = config.scripts[0];
                setFormData({
                    triggerType: generated.triggerType || 'BeforeCreate',
                    scriptContent: generated.scriptContent || '',
                    isActive: generated.isActive !== undefined ? generated.isActive : true
                });
                setShowAiModal(false);
                setAiPrompt('');
                setEditingScript(null);
                setShowModal(true);
            } else {
                alert(t('ai_script_no_result'));
            }
        } catch (err) {
            console.error(err);
            alert(t('ai_script_failed') + ': ' + (err.response?.data?.error || err.message));
        } finally {
            setAiLoading(false);
        }
    };

    const getTriggerBadgeClass = (triggerType) => {
        if (triggerType.includes('Create')) return 'bg-success bg-opacity-10 text-success';
        if (triggerType.includes('Update')) return 'bg-primary bg-opacity-10 text-primary';
        if (triggerType.includes('Delete')) return 'bg-danger bg-opacity-10 text-danger';
        return 'bg-info bg-opacity-10 text-info';
    };

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('loading')}</span>
            </div>
            <p className="mt-2 text-muted">{t('loading_scripts')}</p>
        </div>
    );

    if (error) return (
        <div className="container mt-5">
            <div className="alert alert-danger glass border-danger border-opacity-25 shadow-sm" role="alert">
                <div className="d-flex align-items-center">
                    <div className="me-3 fs-4">⚠️</div>
                    <div>
                        <h5 className="alert-heading mb-1">{t('error')}</h5>
                        <p className="mb-0 text-muted">{error}</p>
                    </div>
                    <button onClick={fetchData} className="btn btn-outline-danger btn-sm ms-auto">
                        {t('load_more')} {/* Using load_more as retry for now or add try_again key if preferred, sticking to existing keys if possible or the ones added */}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
                <div className="d-flex align-items-center gap-3">
                    <button
                        onClick={() => navigate(`/modules/${moduleId}/config`)}
                        className="btn btn-light btn-icon border shadow-sm rounded-circle"
                        title={t('back_config')}
                        style={{ width: '40px', height: '40px' }}
                    >
                        ←
                    </button>
                    <div>
                        <h1 className="display-5 mb-1">{module?.name} {t('module_scripts')}</h1>
                        <p className="text-muted lead mb-0">{t('automate_behaviors')}</p>
                    </div>
                </div>

                <div className="d-flex gap-2">
                    <button
                        onClick={() => setShowAiModal(true)}
                        className="btn btn-outline-info px-3 shadow-sm d-flex align-items-center"
                        title={t('ai_script_btn')}
                    >
                        <span className="me-2">✨</span> AI Script
                    </button>
                    <button
                        onClick={handleAddNew}
                        className="btn btn-primary btn-lg px-4 shadow-sm"
                    >
                        <span className="fs-5 me-2">+</span> {t('add_script')}
                    </button>
                </div>
            </div>

            {/* Content */}
            {scripts.length === 0 ? (
                <div className="text-center py-5 glass rounded-4 border-dashed border-2">
                    <div className="fs-1 mb-3 opacity-50">📜</div>
                    <h3 className="h4">{t('no_scripts_yet')}</h3>
                    <p className="text-muted">{t('no_scripts_desc')}</p>
                    <button onClick={handleAddNew} className="btn btn-primary mt-3">
                        {t('create_first_script')}
                    </button>
                </div>
            ) : (
                <div className="row g-4">
                    {scripts.map((script) => (
                        <div key={script.id} className="col-lg-4 col-md-6">
                            <div
                                className="card h-100 border-0 shadow-soft-hover"
                                onClick={() => handleEdit(script)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="card-body p-4 d-flex flex-column">
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className={`badge ${getTriggerBadgeClass(script.triggerType)} px-2 py-1`}>
                                                {script.triggerType}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge ${script.isActive ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                                                {script.isActive ? t('active') : t('inactive')}
                                            </span>
                                            <button
                                                onClick={(e) => handleDelete(script.id, e)}
                                                className="btn btn-link text-danger p-0 text-decoration-none ms-2"
                                                title={t('delete_module')} // Reusing delete_module or add specific tooltip key if needed.
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>

                                    {/* Code Preview */}
                                    <div className="bg-dark rounded-3 p-3 mb-3 border border-secondary border-opacity-25 overflow-hidden position-relative" style={{ height: '100px' }}>
                                        <div className="font-monospace text-muted small mb-1">// Preview</div>
                                        <pre className="text-light m-0 small" style={{ fontSize: '0.75rem' }}>
                                            {script.scriptContent.trim()}
                                        </pre>
                                        <div className="position-absolute bottom-0 start-0 end-0 p-3" style={{ background: 'linear-gradient(to top, var(--bs-dark), transparent)' }}></div>
                                    </div>

                                    <div className="mt-auto d-flex justify-content-between align-items-center text-muted small">
                                        <span>{t('click_configure')}</span>
                                        <div className="btn btn-light btn-sm rounded-circle shadow-sm" style={{ width: '32px', height: '32px', lineHeight: '18px' }}>
                                            ✎
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* AI Generation Modal */}
            <AiChatModal
                show={showAiModal}
                onClose={() => setShowAiModal(false)}
                generateAi={(prompt, history) => generateAiScriptConfig(moduleId, prompt, history)}
                onApply={(config) => {
                    const scriptsList = config.Scripts || config.scripts;
                    if (scriptsList && scriptsList.length > 0) {
                        const generated = scriptsList[0];
                        setFormData({
                            triggerType: generated.TriggerType || generated.triggerType || 'BeforeCreate',
                            scriptContent: generated.ScriptContent || generated.scriptContent || '',
                            isActive: generated.IsActive !== undefined ? generated.IsActive : (generated.isActive !== undefined ? generated.isActive : true)
                        });
                        setShowAiModal(false);
                        setEditingScript(null);
                        setShowModal(true);
                    } else {
                        alert(t('ai_script_no_result'));
                    }
                }}
                title={t('ai_script_title')}
                placeholder={t('ai_script_prompt_placeholder')}
            />

            {/* Modal */}
            {showModal && (
                <div className="modal fade show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-xl overflow-hidden">
                            <div className="modal-header modal-header-premium border-0">
                                <h5 className="modal-title fw-extrabold text-gradient">
                                    {editingScript ? t('edit_script') : t('new_script')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body modal-body-premium" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                <form id="scriptForm" onSubmit={handleSubmit}>
                                    <div className="row g-4 mb-4">
                                        <div className="col-md-7">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted">{t('trigger_event')}</label>
                                            <select
                                                value={formData.triggerType}
                                                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                                                className="form-select border-2"
                                                disabled={!!editingScript}
                                            >
                                                {triggerTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-5">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted">{t('status')}</label>
                                            <div className="p-2 px-3 bg-light bg-opacity-50 rounded-3 border border-theme-accent d-flex align-items-center justify-content-between h-50 mt-1">
                                                <span className="small fw-bold text-muted">{formData.isActive ? t('active') : t('inactive')}</span>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input ms-0"
                                                        type="checkbox"
                                                        id="isActiveSwitch"
                                                        checked={formData.isActive}
                                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                        style={{ width: '2.5rem', height: '1.25rem' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Code Editor */}
                                    <div className="mb-0">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted m-0">{t('script_code')}</label>
                                            <span className="badge badge-outline-theme px-3 py-2">JavaScript (Jint/V8)</span>
                                        </div>
                                        <div className="card border-0 bg-dark text-white rounded-4 overflow-hidden shadow-lg">
                                            <div className="card-header bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-10 py-3 d-flex align-items-center">
                                                <div className="d-flex gap-2 me-4">
                                                    <div className="rounded-circle bg-danger opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                                    <div className="rounded-circle bg-warning opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                                    <div className="rounded-circle bg-success opacity-75" style={{ width: '12px', height: '12px' }}></div>
                                                </div>
                                                <span className="font-monospace small opacity-50 tracking-widest">MODULE_HANDLER.JS</span>
                                            </div>
                                            <textarea
                                                value={formData.scriptContent}
                                                onChange={(e) => setFormData({ ...formData, scriptContent: e.target.value })}
                                                className="form-control bg-dark text-light border-0 font-monospace small p-4 shadow-inner"
                                                style={{ height: '350px', resize: 'none', borderRadius: 0, fontSize: '0.9rem', lineHeight: '1.6' }}
                                                spellCheck="false"
                                            />
                                            <div className="card-footer bg-secondary bg-opacity-10 border-top border-secondary border-opacity-10 py-3 d-flex justify-content-between align-items-center">
                                                <div className="font-monospace small d-flex gap-3">
                                                    <span className="text-info opacity-75">Db</span>
                                                    <span className="text-primary opacity-75">Data</span>
                                                    <span className="text-success opacity-75">User</span>
                                                    <span className="text-danger opacity-75">Fail()</span>
                                                </div>
                                                <span className="small text-muted opacity-50">{t('readonly_context')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer modal-footer-premium border-0 mb-3">
                                <button
                                    type="button"
                                    className="btn btn-blur px-4"
                                    onClick={() => setShowModal(false)}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    form="scriptForm"
                                    className="btn btn-primary px-5 shadow-md hover-lift"
                                >
                                    {t('save_script')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModuleScriptsPage;