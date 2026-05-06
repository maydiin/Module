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
    getFields
} from '../services/api';
import Icon from '../components/Icon';

const ModuleVisibilityRulesPage = () => {
    const { t } = useTranslation();
    const { moduleId } = useParams();
    const navigate = useNavigate();
    
    const [module, setModule] = useState(null);
    const [rules, setRules] = useState([]);
    const [roles, setRoles] = useState([]);
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    
    const [formData, setFormData] = useState({
        roleId: '',
        field: '',
        operator: 'eq',
        value: '',
        action: 'Hide',
        isActive: true
    });

    const operators = [
        { value: 'eq', label: 'Eşittir (==)' },
        { value: 'neq', label: 'Eşit Değildir (!=)' },
        { value: 'contains', label: 'İçerir' },
        { value: 'gt', label: 'Büyüktür (>)' },
        { value: 'lt', label: 'Küçüktür (<)' }
    ];

    const actions = [
        { value: 'Hide', label: 'Gizle' },
        { value: 'Show', label: 'Göster' }
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
                { name: '__createdByUserId', label: 'Oluşturan Kullanıcı ID' },
                ...fieldsData.filter(f => f.isStored)
            ]);
        } catch (err) {
            setError('Veriler yüklenirken bir hata oluştu.');
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

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Bu kuralı silmek istediğinize emin misiniz?')) {
            try {
                await deleteVisibilityRule(moduleId, id);
                fetchData();
            } catch (err) {
                alert('Silme işlemi başarısız oldu.');
            }
        }
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
            alert('Kaydetme işlemi başarısız oldu: ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('loading')}</span>
            </div>
            <p className="mt-2 text-muted">Kayıt görünürlük kuralları yükleniyor...</p>
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
                        Tekrar Dene
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
                            <span className="opacity-40 ms-3 fw-400" style={{ fontSize: '0.8em' }}>Görünürlük Kuralları</span>
                        </h1>
                        <p className="text-muted mb-0 lead fw-medium opacity-70" style={{ fontSize: '1rem' }}>Rol tabanlı veya dinamik (Sadece Benim Kayıtlarım) veri kısıtlamalarını yönetin.</p>
                    </div>
                </div>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                    <button
                        onClick={handleAddNew}
                        className="btn btn-primary px-4 shadow-premium hover-lift fw-bold"
                    >
                        <Icon name="plus" size={20} className="me-2" />
                        Yeni Kural
                    </button>
                </div>
            </div>

            {rules.length === 0 ? (
                <div className="text-center py-5 glass-card rounded-4 border-dashed border-2 mt-4 fade-in">
                    <div className="display-1 mb-3 opacity-25">🛡️</div>
                    <h3 className="h4 fw-bold">Henüz Kural Yok</h3>
                    <p className="text-muted mx-auto" style={{ maxWidth: '400px' }}>Bu modül için herhangi bir kayıt görünürlük kuralı tanımlanmamış. Herkes yetkisi dahilinde tüm kayıtları görebilir.</p>
                    <button onClick={handleAddNew} className="btn btn-primary px-5 py-2 mt-3 shadow-premium hover-lift">
                        İlk Kuralı Oluştur
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
                                                {rule.action === 'Hide' ? 'GİZLE' : 'GÖSTER'}
                                            </div>
                                            {rule.roleName && (
                                                <div className="badge bg-primary bg-opacity-10 text-primary px-3 py-2 rounded-3 small fw-bold">
                                                    {rule.roleName}
                                                </div>
                                            )}
                                            {!rule.roleName && (
                                                <div className="badge border border-secondary text-secondary px-3 py-2 rounded-3 small fw-bold">
                                                    TÜM ROLLER
                                                </div>
                                            )}
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge ${rule.isActive ? 'bg-success text-white' : 'bg-secondary text-white'} px-2 py-1 rounded-pill`}>
                                                {rule.isActive ? 'Aktif' : 'Pasif'}
                                            </span>
                                            <button
                                                onClick={(e) => handleDelete(rule.id, e)}
                                                className="btn btn-sm btn-outline-danger border-0 rounded-circle d-flex align-items-center justify-content-center"
                                                title="Sil"
                                                style={{ width: '30px', height: '30px' }}
                                            >
                                                <Icon name="x" size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-3 bg-surface bg-opacity-50 rounded-4 mb-4 border border-secondary border-opacity-10">
                                        <div className="d-flex flex-column gap-2 small font-monospace">
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>Alan:</span>
                                                <span className="fw-bold text-foreground">{rule.field}</span>
                                            </div>
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>Operatör:</span>
                                                <span className="fw-bold text-info">{rule.operator}</span>
                                            </div>
                                            <div className="d-flex">
                                                <span className="text-muted" style={{ width: '70px' }}>Değer:</span>
                                                <span className="fw-bold text-success">{rule.value || ' (Boş)'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto d-flex justify-content-between align-items-center text-muted small border-top border-theme-accent pt-3">
                                        <span className="opacity-70 fw-medium d-flex align-items-center gap-2">
                                            <Icon name="edit" size={12} /> Düzenlemek için tıklayın
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
                                    {editingRule ? 'Kuralı Düzenle' : 'Yeni Kural Oluştur'}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body modal-body-premium p-4" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                                <form id="ruleForm" onSubmit={handleSubmit}>
                                    <div className="row g-4 mb-3">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">Rol (Opsiyonel)</label>
                                            <select
                                                value={formData.roleId}
                                                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                                                className="form-select border-2 shadow-sm"
                                                style={{ height: '50px' }}
                                            >
                                                <option value="">-- Tüm Roller Geçerli --</option>
                                                {roles.map(role => (
                                                    <option key={role.id} value={role.id}>{role.name}</option>
                                                ))}
                                            </select>
                                            <div className="form-text small opacity-75">Boş bırakılırsa tüm kullanıcılar için geçerli olur.</div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">Aksiyon</label>
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
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">Alan (Field)</label>
                                            <input
                                                type="text"
                                                list="fieldList"
                                                value={formData.field}
                                                onChange={(e) => setFormData({ ...formData, field: e.target.value })}
                                                className="form-control border-2 shadow-sm"
                                                placeholder="Örn: status veya __createdByUserId"
                                                style={{ height: '50px' }}
                                                required
                                            />
                                            <datalist id="fieldList">
                                                {fields.map(f => (
                                                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                                ))}
                                            </datalist>
                                        </div>
                                        <div className="col-md-4">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">Operatör</label>
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
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">Değer (Value)</label>
                                            <input
                                                type="text"
                                                value={formData.value}
                                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                                className="form-control border-2 shadow-sm"
                                                placeholder="Örn: {{CurrentUser.Id}} veya Active"
                                                style={{ height: '50px' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4 d-flex justify-content-end">
                                        <div className="form-check form-switch mt-3 d-flex align-items-center gap-2">
                                            <label className="form-check-label ms-2 mt-1 fw-bold text-muted small" htmlFor="isActiveSwitch">Kural Aktif</label>
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
                                                <h6 className="alert-heading fw-bold text-primary mb-1">Dinamik İpuçları</h6>
                                                <p className="small mb-1 opacity-75">
                                                    <strong>Sadece Kendi Kayıtlarını Görme:</strong> Alan olarak <code>__createdByUserId</code> Seçin, Operatör: <code>Eşit Değildir (!=)</code>, Değer olarak <code>{`{{CurrentUser.Id}}`}</code> girin ve Aksiyon: <code>Gizle</code> yapın.
                                                </p>
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
                                    form="ruleForm"
                                    className="btn btn-primary px-5 py-2 shadow-premium hover-lift fw-extrabold text-uppercase d-flex align-items-center gap-2"
                                >
                                    <Icon name="check" size={18} />
                                    Kaydet
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

export default ModuleVisibilityRulesPage;
