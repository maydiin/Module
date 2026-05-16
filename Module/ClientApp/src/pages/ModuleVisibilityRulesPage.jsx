import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
    getVisibilityRules, 
    createVisibilityRule, 
    updateVisibilityRule, 
    deleteVisibilityRule, 
    getModule,
    getRoles,
    getFields,
    generateAiVisibilityRuleConfig,
    applyAiConfig
} from '../services/api';
import Icon from '../components/Icon';
import AiChatModal from '../components/AiChatModal';
import { useToast } from '../components/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const ModuleVisibilityRulesPage = () => {
    const { t } = useTranslation();
    const showToast = useToast();
    const { moduleId } = useParams();
    const navigate = useNavigate();
    
    const [module, setModule] = useState(null);
    const [rules, setRules] = useState([]);
    const [roles, setRoles] = useState([]);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [deleteRuleId, setDeleteRuleId] = useState(null);
    
    const [formData, setFormData] = useState({
        roleId: '',
        field: '',
        operator: 'eq',
        value: '',
        action: 'Hide',
        isActive: true
    });

    const operators = [
        { value: 'eq', label: t('op_eq') },
        { value: 'neq', label: t('op_neq') },
        { value: 'contains', label: t('op_contains') },
        { value: 'gt', label: t('op_gt') },
        { value: 'lt', label: t('op_lt') }
    ];

    const actions = [
        { value: 'Hide', label: t('hide') },
        { value: 'Show', label: t('show') }
    ];

    useEffect(() => {
        fetchData();
    }, [moduleId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [moduleData, rulesData, rolesData, fieldsData] = await Promise.all([
                getModule(moduleId),
                getVisibilityRules(moduleId),
                getRoles(),
                getFields(moduleId)
            ]);
            setModule(moduleData);
            setRules(rulesData);
            setRoles(rolesData);
            setFields([
                { name: '__createdByUserId', label: t('audit_col_user') || 'Oluşturan Kullanıcı' },
                ...fieldsData.filter(f => f.isStored !== false)
            ]);
        } catch (err) {
            setError(t('error_occurred_please_try_again'));
            console.error('Error loading visibility rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (rule) => {
        setEditingRule(rule);
        setFormData({
            roleId: rule.roleId || '',
            field: rule.field || '',
            operator: rule.operator || 'eq',
            value: rule.value || '',
            action: rule.action || 'Hide',
            isActive: rule.isActive
        });
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingRule(null);
        setFormData({
            roleId: '',
            field: '',
            operator: 'eq',
            value: '',
            action: 'Hide',
            isActive: true
        });
        setShowModal(true);
    };

    const handleDelete = async () => {
        if (!deleteRuleId) return;
        try {
            await deleteVisibilityRule(moduleId, deleteRuleId);
            fetchData();
            setDeleteRuleId(null);
            setShowModal(false);
        } catch (err) {
            showToast(t('delete_failed'), 'error');
        }
    };
    
    const handleDeleteClick = (id, e) => {
        if (e) e.stopPropagation();
        setDeleteRuleId(id);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                roleId: formData.roleId ? parseInt(formData.roleId) : null,
                field: formData.field,
                operator: formData.operator,
                value: formData.value,
                action: formData.action,
                isActive: formData.isActive
            };

            if (editingRule) {
                await updateVisibilityRule(moduleId, editingRule.id, payload);
            } else {
                await createVisibilityRule(moduleId, payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            showToast(t('save_failed') + ': ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('loading')}</span>
            </div>
            <p className="mt-2 text-muted">{t('loading_visibility_rules')}</p>
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
                        {t('retry')}
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
                            <span className="opacity-40 ms-3 fw-400" style={{ fontSize: '0.8em' }}>{t('visibility_rules')}</span>
                        </h1>
                        <p className="text-muted mb-0 lead fw-medium opacity-70" style={{ fontSize: '1rem' }}>{t('visibility_rules_desc')}</p>
                    </div>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                    <button
                        className="btn btn-blur text-foreground border-0 shadow-premium hover-lift px-4"
                        onClick={() => setShowAiModal(true)}
                        style={{ backdropFilter: 'blur(10px)' }}
                    >
                        <Icon name="sparkles" size={16} className="me-1 me-md-2" />
                        <span className="d-none d-sm-inline">{t('ai_architect')}</span>
                        <span className="d-sm-none">{t('ai')}</span>
                    </button>
                    <button
                        onClick={handleAddNew}
                        className="btn btn-primary px-4 shadow-premium hover-lift fw-bold"
                    >
                        <Icon name="plus" size={20} className="me-2" />
                        {t('new_rule')}
                    </button>
                </div>
            </div>

            {rules.length === 0 ? (
                <div className="text-center py-5 glass-card rounded-4 border-dashed border-2 mt-4 fade-in">
                    <div className="display-1 mb-3 opacity-25">🛡️</div>
                    <h3 className="h4 fw-bold">{t('no_rules_yet_title')}</h3>
                    <p className="text-muted mx-auto" style={{ maxWidth: '400px' }}>{t('no_rules_yet_desc')}</p>
                    <button onClick={handleAddNew} className="btn btn-primary px-5 py-2 mt-3 shadow-premium hover-lift">
                        {t('create_first_rule')}
                    </button>
                </div>
            ) : (
                <div className="row g-4 fade-in">
                    {rules.map((rule) => (
                        <div key={rule.id} className="col-lg-4 col-md-6">
                            <div
                                className="card h-100 border-0 glass-card shadow-soft-hover overflow-hidden"
                                onClick={() => handleEdit(rule)}
                                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                            >
                                <div className="card-body p-4 d-flex flex-column">
                                    <div className="d-flex align-items-center justify-content-between mb-4">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className={`badge ${rule.action === 'Hide' ? 'bg-danger' : 'bg-success'} bg-opacity-10 ${rule.action === 'Hide' ? 'text-danger' : 'text-success'} px-3 py-2 rounded-3 small fw-bold text-uppercase`}>
                                                {rule.action === 'Hide' ? t('hide') : t('show')}
                                            </div>
                                            {rule.roleName && (
                                                <div className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-3 small fw-bold">
                                                    {rule.roleName}
                                                </div>
                                            )}
                                            {!rule.roleName && (
                                                <div className="badge border border-secondary text-secondary px-3 py-2 rounded-3 small fw-bold">
                                                    {t('all_roles')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge ${rule.isActive ? 'bg-success text-white' : 'bg-secondary text-white'} px-2 py-1 rounded-pill`}>
                                                {rule.isActive ? t('active') : t('inactive')}
                                            </span>
                                            <button
                                                onClick={(e) => handleDeleteClick(rule.id, e)}
                                                className="btn btn-sm btn-outline-danger border-0 rounded-circle d-flex align-items-center justify-content-center"
                                                title={t('delete')}
                                                style={{ width: '30px', height: '30px' }}
                                            >
                                                <Icon name="delete" size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-surface bg-opacity-50 rounded-4 mb-4 border border-secondary border-opacity-10">
                                        <div className="d-flex flex-column gap-2 small font-monospace">
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>{t('filter_field')}:</span>
                                                <span className="fw-bold text-foreground">{rule.field}</span>
                                            </div>
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>{t('filter_operator')}:</span>
                                                <span className="fw-bold text-info">{rule.operator}</span>
                                            </div>
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>{t('filter_value')}:</span>
                                                <span className="fw-bold text-success">{rule.value || ` (${t('filter_is_empty')})`}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto d-flex justify-content-between align-items-center text-muted small border-top border-theme-accent pt-3">
                                        <span className="opacity-70 fw-medium d-flex align-items-center gap-2">
                                            <Icon name="edit" size={12} /> {t('edit_to_modify')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && createPortal(
                <div className="modal show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-premium overflow-hidden rounded-4">
                            <div className="modal-header modal-header-premium border-0 py-4 px-4">
                                <h5 className="modal-title fw-extrabold text-gradient d-flex align-items-center gap-3">
                                    <div className="p-2 bg-primary bg-opacity-10 rounded-3">
                                        <Icon name={editingRule ? "edit" : "plus"} size={24} />
                                    </div>
                                    {editingRule ? t('edit_rule_title') : t('create_rule_title')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body modal-body-premium p-4" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                <form id="ruleForm" onSubmit={handleSubmit}>
                                    <div className="row g-4 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('role_optional')}</label>
                                            <select
                                                value={formData.roleId}
                                                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                                className="form-select border-2 shadow-sm"
                                                style={{ height: '50px' }}
                                            >
                                                <option value="">{t('all_roles_applicable')}</option>
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.id}>{role.name}</option>
                                                ))}
                                            </select>
                                            <div className="form-text small opacity-75">{t('user_roles_help')}</div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('action')}</label>
                                            <select
                                                value={formData.action}
                                                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                                                className="form-select border-2 shadow-sm"
                                                style={{ height: '50px' }}
                                            >
                                                {actions.map(action => (
                                                    <option key={action.value} value={action.value}>{action.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="row g-4 mb-3">
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('filter_field')}</label>
                                            <select
                                                value={formData.field}
                                                onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                                                className="form-select border-2 shadow-sm"
                                                style={{ height: '50px' }}
                                                required
                                            >
                                                <option value="">{t('field_placeholder')}</option>
                                                {fields.map(f => (
                                                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('filter_operator')}</label>
                                            <select
                                                value={formData.operator}
                                                onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                                                className="form-select border-2 shadow-sm"
                                                style={{ height: '50px' }}
                                                required
                                            >
                                                {operators.map(op => (
                                                    <option key={op.value} value={op.value}>{op.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('value')}</label>
                                            <input
                                                value={formData.value}
                                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                                className="form-control border-2 shadow-sm"
                                                placeholder={t('visibility_placeholder_hint', 'Örn: {{CurrentUser.Id}} veya Active')}
                                                style={{ height: '50px' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4 d-flex justify-content-end">
                                        <div className="form-check form-switch mt-3 d-flex align-items-center gap-2">
                                            <label className="form-check-label ms-2 mt-1 fw-bold text-muted small" htmlFor="isActiveSwitch">{t('rule_active')}</label>
                                            <input
                                                className="form-check-input ms-0 mt-1 shadow-sm"
                                                type="checkbox"
                                                id="isActiveSwitch"
                                                checked={formData.isActive}
                                                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                style={{ width: '3rem', height: '1.5rem', cursor: 'pointer' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="alert bg-surface border-primary border-opacity-25 rounded-4 alert-dismissible fade show shadow-sm">
                                        <div className="d-flex">
                                            <div className="me-3 fs-3">💡</div>
                                            <div>
                                                <h6 className="alert-heading fw-bold text-primary mb-2">{t('dynamic_tips_title')}</h6>
                                                <div className="small opacity-75">
                                                    <div className="mb-2">
                                                        <strong>{t('only_own_records')}:</strong>
                                                        <br />
                                                        {t('filter_field')}: <code>{t('audit_col_user')}</code>, {t('filter_operator')}: <code>{t('op_eq')}</code>, {t('filter_value')}: <code>{`{{CurrentUser.Id}}`}</code>, {t('action')}: <code>{t('show')}</code>
                                                    </div>
                                                    <div className="mb-2">
                                                        <strong>{t('hide_others_records')}:</strong>
                                                        <br />
                                                        {t('filter_field')}: <code>{t('audit_col_user')}</code>, {t('filter_operator')}: <code>{t('op_neq')}</code>, {t('filter_value')}: <code>{`{{CurrentUser.Id}}`}</code>, {t('action')}: <code>{t('hide')}</code>
                                                    </div>
                                                    <div className="mt-2 pt-2 border-top border-primary border-opacity-10">
                                                        {t('dynamic_tips_desc')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                </form>
                            </div>
                            <div className="modal-footer modal-footer-premium border-0 py-4 px-4 bg-surface bg-opacity-50 justify-content-between">
                                <div className="d-flex gap-2">
                                    {editingRule && (
                                        <button
                                            type="button"
                                            className="btn btn-outline-danger px-4 fw-bold d-flex align-items-center gap-2"
                                            onClick={(e) => handleDeleteClick(editingRule.id, e)}
                                        >
                                            <Icon name="delete" size={18} />
                                            {t('delete')}
                                        </button>
                                    )}
                                </div>
                                <div className="d-flex gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-blur px-5 fw-bold"
                                        onClick={() => setShowModal(false)}
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        form="ruleForm"
                                        className="btn btn-primary px-5 py-2 shadow-premium hover-lift fw-extrabold text-uppercase d-flex align-items-center gap-2"
                                    >
                                        <Icon name="check" size={18} />
                                        {t('save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* AI Modal */}
            <AiChatModal
                show={showAiModal}
                onClose={() => setShowAiModal(false)}
                generateAi={(prompt, history) => generateAiVisibilityRuleConfig(moduleId, prompt, history)}
                onApply={async (config) => {
                    try {
                        await applyAiConfig(config);
                        setShowAiModal(false);
                        fetchData();
                        showToast(t('ai_success_msg'), 'success');
                    } catch (err) {
                        showToast(t('ai_apply_error') + " " + (err.response?.data || err.message), 'error');
                    }
                }}
                title={t('ai_architect_modal_title')}
                placeholder={t('ai_prompt_placeholder')}
            />

            <ConfirmModal
                show={!!deleteRuleId}
                onClose={() => setDeleteRuleId(null)}
                onConfirm={handleDelete}
                title={t('delete_rule')}
                message={t('delete_rule_confirm')}
                confirmText={t('delete')}
                type="danger"
            />
        </div>
    );
};

export default ModuleVisibilityRulesPage;
