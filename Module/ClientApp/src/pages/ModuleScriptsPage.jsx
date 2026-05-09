import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getScripts, createScript, updateScript, deleteScript, getModule, generateAiScriptConfig } from '../services/api';
import AiChatModal from '../components/AiChatModal';
import Icon from '../components/Icon';
import { useToast } from '../components/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const ModuleScriptsPage = () => {
    const { t } = useTranslation();
    const showToast = useToast();
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
    const [deleteScriptId, setDeleteScriptId] = useState(null);

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

    const handleDelete = async () => {
        if (!deleteScriptId) return;
        try {
            await deleteScript(moduleId, deleteScriptId);
            fetchData();
            setDeleteScriptId(null);
        } catch (err) {
            showToast(t('failed_delete_script'), 'error');
        }
    };
    
    const handleDeleteClick = (id, e) => {
        e.stopPropagation();
        setDeleteScriptId(id);
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
            showToast(t('failed_save_script') + ': ' + (err.response?.data?.error || err.message), 'error');
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
                showToast(t('ai_script_no_result'), 'warning');
            }
        } catch (err) {
            console.error(err);
            showToast(t('ai_script_failed') + ': ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const getTriggerBadgeClass = (triggerType) => {
        if (triggerType.includes('Create')) return 'bg-success bg-opacity-10 text-success';
        if (triggerType.includes('Update')) return 'badge-soft-primary';
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
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
                <div className="d-flex align-items-center">
                    <button
                        className="btn btn-blur bg-surface bg-opacity-50 border-0 me-3 shadow-sm hover-shift-left transition-all p-3 d-none d-md-flex align-items-center justify-content-center"
                        onClick={() => navigate('/')}
                        style={{ borderRadius: '18px', width: '56px', height: '56px' }}
                    >
                        <Icon name="arrowLeft" size={24} className="icon-theme" />
                    </button>
                    <div>
                        <h1 className="display-5 mb-1 fw-800">
                            <span className="text-gradient">
                                {module?.name}
                            </span>
                            <span className="opacity-40 ms-3 fw-400" style={{ fontSize: '0.8em' }}>{t('module_scripts')}</span>
                        </h1>
                        <p className="text-muted mb-0 lead fw-medium opacity-70" style={{ fontSize: '1rem' }}>{t('automate_behaviors')}</p>
                    </div>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                    <button
                        onClick={() => setShowAiModal(true)}
                        className="btn btn-blur bg-surface bg-opacity-50 border-0 px-4 shadow-premium hover-lift text-info fw-bold"
                        title={t('ai_script_btn')}
                        style={{ backdropFilter: 'blur(10px)' }}
                    >
                        <span className="me-2">✨</span> {t('ai_script_btn').replace('✨ ', '')}
                    </button>
                    <button
                        onClick={handleAddNew}
                        className="btn btn-primary px-4 shadow-premium hover-lift fw-bold"
                    >
                        <Icon name="plus" size={20} className="me-2" />
                        {t('add_script')}
                    </button>
                </div>
            </div>

            {/* Content */}
            {scripts.length === 0 ? (
                <div className="text-center py-5 glass-card rounded-4 border-dashed border-2 mt-4 fade-in">
                    <div className="display-1 mb-3 opacity-25">📜</div>
                    <h3 className="h4 fw-bold">{t('no_scripts_yet')}</h3>
                    <p className="text-muted mx-auto" style={{ maxWidth: '400px' }}>{t('no_scripts_desc')}</p>
                    <button onClick={handleAddNew} className="btn btn-primary px-5 py-2 mt-3 shadow-premium hover-lift">
                        {t('create_first_script')}
                    </button>
                </div>
            ) : (
                <div className="row g-4 fade-in">
                    {scripts.map((script) => (
                        <div key={script.id} className="col-lg-4 col-md-6">
                            <div
                                className="card h-100 border-0 glass-card shadow-soft-hover overflow-hidden"
                                onClick={() => handleEdit(script)}
                                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                            >
                                <div className="card-body p-4 d-flex flex-column">
                                    <div className="d-flex align-items-center justify-content-between mb-4">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className={`badge ${getTriggerBadgeClass(script.triggerType)} px-3 py-2 rounded-3 small fw-bold text-uppercase`}>
                                                {script.triggerType}
                                            </div>
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge ${script.isActive ? 'bg-success text-white' : 'bg-secondary text-white'} px-2 py-1 rounded-pill`}>
                                                {script.isActive ? t('active') : t('inactive')}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteClick(script.id, e)}
                                                className="btn btn-sm btn-outline-danger border-0 rounded-circle d-flex align-items-center justify-content-center"
                                                title={t('delete_module')}
                                                style={{ width: '30px', height: '30px' }}
                                            >
                                                <Icon name="x" size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Code Preview */}
                                    <div className="bg-dark rounded-4 p-4 mb-4 border border-secondary border-opacity-10 overflow-hidden position-relative shadow-inner" style={{ height: '120px' }}>
                                        <div className="font-monospace text-muted small mb-2 opacity-50 fw-bold">// {t('preview')}</div>
                                        <pre className="text-light m-0 small" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                            {script.scriptContent.trim().substring(0, 150)}{script.scriptContent.length > 150 ? '...' : ''}
                                        </pre>
                                        <div className="position-absolute bottom-0 start-0 end-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}></div>
                                    </div>

                                    <div className="mt-auto d-flex justify-content-between align-items-center text-muted small border-top border-theme-accent pt-3">
                                        <span className="opacity-70 fw-medium d-flex align-items-center gap-2">
                                            <Icon name="edit" size={12} /> {t('click_configure')}
                                        </span>
                                        <div className="btn btn-blur btn-sm rounded-circle shadow-sm d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                            <Icon name="arrowLeft" size={14} style={{ transform: 'rotate(180deg)' }} />
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
                        showToast(t('ai_script_no_result'), 'warning');
                    }
                }}
                title={t('ai_script_title')}
                placeholder={t('ai_script_prompt_placeholder')}
            />

            <ConfirmModal
                show={!!deleteScriptId}
                onClose={() => setDeleteScriptId(null)}
                onConfirm={handleDelete}
                title={t('delete_script')}
                message={t('confirm_delete_script')}
                confirmText={t('delete')}
                type="danger"
            />

            {/* Modal */}
            {showModal && createPortal(
                <div className="modal show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-premium overflow-hidden rounded-4">
                            <div className="modal-header modal-header-premium border-0 py-4 px-4">
                                <h5 className="modal-title fw-extrabold text-gradient d-flex align-items-center gap-3">
                                    <div className="p-2 bg-primary bg-opacity-10 rounded-3">
                                        <Icon name={editingScript ? "edit" : "plus"} size={24} />
                                    </div>
                                    {editingScript ? t('edit_script') : t('new_script')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body modal-body-premium p-4" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                <form id="scriptForm" onSubmit={handleSubmit}>
                                    <div className="row g-4 mb-4">
                                        <div className="col-md-7">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('trigger_event')}</label>
                                            <div className="input-group">
                                                <span className="input-group-text bg-surface border-2 border-end-0">
                                                    <Icon name="settings" size={18} className="text-primary" />
                                                </span>
                                                <select
                                                    value={formData.triggerType}
                                                    onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
                                                    className="form-select border-2 shadow-sm"
                                                    disabled={!!editingScript}
                                                    style={{ height: '50px' }}
                                                >
                                                    {triggerTypes.map(type => (
                                                        <option key={type} value={type}>
                                                            {type}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="col-md-5">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('status')}</label>
                                            <div className="p-2 px-3 bg-surface bg-opacity-50 rounded-3 border-2 border shadow-sm d-flex align-items-center justify-content-between" style={{ height: '50px' }}>
                                                <span className="small fw-bold text-foreground opacity-80 d-flex align-items-center gap-2">
                                                    <div className={`rounded-circle ${formData.isActive ? 'bg-success' : 'bg-secondary'}`} style={{ width: '8px', height: '8px shadow-sm' }}></div>
                                                    {formData.isActive ? t('active') : t('inactive')}
                                                </span>
                                                <div className="form-check form-switch p-0 m-0">
                                                    <input
                                                        className="form-check-input ms-0"
                                                        type="checkbox"
                                                        id="isActiveSwitch"
                                                        checked={formData.isActive}
                                                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                        style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Code Editor */}
                                    <div className="mb-0">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted m-0 d-flex align-items-center gap-2">
                                                <Icon name="terminal" size={14} /> {t('script_code')}
                                            </label>
                                            <span className="badge badge-outline-theme px-3 py-2 rounded-pill fw-bold">JavaScript (Jint/V8)</span>
                                        </div>
                                        <div className="card border-0 bg-dark text-white rounded-4 overflow-hidden shadow-lg border border-secondary border-opacity-10">
                                            <div className="card-header bg-secondary bg-opacity-10 border-bottom border-secondary border-opacity-10 py-3 d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div className="d-flex gap-2">
                                                        <div className="rounded-circle bg-danger opacity-75 shadow-sm" style={{ width: '12px', height: '12px' }}></div>
                                                        <div className="rounded-circle bg-warning opacity-75 shadow-sm" style={{ width: '12px', height: '12px' }}></div>
                                                        <div className="rounded-circle bg-success opacity-75 shadow-sm" style={{ width: '12px', height: '12px' }}></div>
                                                    </div>
                                                    <span className="font-monospace small opacity-50 tracking-widest text-uppercase">MODULE_HANDLER.JS</span>
                                                </div>
                                                <div className="opacity-50 small font-monospace">UTF-8</div>
                                            </div>
                                            <textarea
                                                value={formData.scriptContent}
                                                onChange={(e) => setFormData({ ...formData, scriptContent: e.target.value })}
                                                className="form-control bg-dark text-light border-0 font-monospace p-4 shadow-inner custom-scrollbar"
                                                style={{ height: '400px', resize: 'none', borderRadius: 0, fontSize: '0.95rem', lineHeight: '1.6', letterSpacing: '0.02em' }}
                                                spellCheck="false"
                                                placeholder={t('script_placeholder') || "// Write your automation logic here..."}
                                            />
                                            <div className="card-footer bg-secondary bg-opacity-10 border-top border-secondary border-opacity-10 py-3 d-flex justify-content-between align-items-center">
                                                <div className="font-monospace small d-flex gap-3">
                                                    <span className="text-info opacity-80 px-2 py-1 bg-info bg-opacity-10 rounded">Db</span>
                                                    <span className="text-primary opacity-80 px-2 py-1 bg-primary bg-opacity-10 rounded">Data</span>
                                                    <span className="text-success opacity-80 px-2 py-1 bg-success bg-opacity-10 rounded">User</span>
                                                    <span className="text-danger opacity-80 px-2 py-1 bg-danger bg-opacity-10 rounded">Fail()</span>
                                                </div>
                                                <span className="small text-muted opacity-60 d-flex align-items-center gap-2">
                                                    <Icon name="lightbulb" size={14} /> {t('readonly_context')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer modal-footer-premium border-0 py-4 px-4 bg-surface bg-opacity-50">
                                <button
                                    type="button"
                                    className="btn btn-blur px-5 fw-bold"
                                    onClick={() => setShowModal(false)}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    form="scriptForm"
                                    className="btn btn-primary px-5 py-2 shadow-premium hover-lift fw-extrabold text-uppercase d-flex align-items-center gap-2"
                                >
                                    <Icon name="check" size={18} />
                                    {t('save_script')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ModuleScriptsPage;