import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModule, getFields, getRecord, getModules, HOST_URL, approveRecord, rejectRecord } from '../services/api';
import axios from 'axios';
import Icon from '../components/Icon';
import { useToast } from '../components/ToastContext';

function RecordDetailPage() {
    const { t } = useTranslation();
    const showToast = useToast();
    const { moduleId, recordId } = useParams();
    const navigate = useNavigate();
    
    const [module, setModule] = useState(null);
    const [fields, setFields] = useState([]);
    const [record, setRecord] = useState(null);
    
    const [summary, setSummary] = useState([]);
    const [moduleRecords, setModuleRecords] = useState({});
    const [allModules, setAllModules] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [error, setError] = useState('');
    const [expandedModule, setExpandedModule] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [approvalHistory, setApprovalHistory] = useState(null);

    const handleApprove = async () => {
        try {
            setActionLoading(true);
            await approveRecord(moduleId, recordId);
            showToast(t('record_approved') || 'Kayıt onaylandı!', 'success');
            await loadData(); // Reload to get updated status
        } catch (err) {
            showToast(err.response?.data?.error || t('error'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        const reason = window.prompt(t('reject_reason') || 'Ret sebebi giriniz:');
        if (reason === null) return; // cancelled
        try {
            setActionLoading(true);
            await rejectRecord(moduleId, recordId, reason || '-');
            showToast(t('record_rejected') || 'Kayıt reddedildi!', 'success');
            await loadData();
        } catch (err) {
            showToast(err.response?.data?.error || t('error'), 'error');
        } finally {
            setActionLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [moduleId, recordId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [moduleData, fieldsData, recordData, moduleslistData] = await Promise.all([
                getModule(moduleId),
                getFields(moduleId),
                getRecord(moduleId, recordId),
                getModules()
            ]);
            setModule(moduleData);
            setFields(fieldsData);
            setRecord(recordData);
            setAllModules(moduleslistData || []);
            
            if (moduleData && moduleData.name) {
                fetchSummary(moduleData.name, recordData.id, fieldsData, recordData);
            }

            try {
                const historyRes = await axios.get(`/api/modules/${moduleId}/records/${recordId}/approval-history`);
                setApprovalHistory(historyRes.data || null);
            } catch (hErr) {
                console.error("Failed to load approval history", hErr);
            }
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async (moduleName, rId, fieldsList = fields, recData = record) => {
        try {
            setLoadingSummary(true);
            const response = await axios.get(`/api/relations/summary?module=${encodeURIComponent(moduleName)}&id=${rId}`);
            const summaryData = response.data || [];
            setSummary(summaryData);
            
            if (summaryData.length > 0) {
               handleExpand(summaryData[0].module, moduleName, rId);
            } else if (fieldsList && recData) {
               const firstSubgrid = fieldsList.find(f => f.type === 'relations');
               if (firstSubgrid) {
                   setExpandedModule(firstSubgrid.name);
               }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSummary(false);
        }
    };

    const handleExpand = async (sourceModule, modName = module?.name, rId = record?.id) => {
        if (!modName || !rId) return;

        if (expandedModule === sourceModule) {
            setExpandedModule(null);
            return;
        }

        setExpandedModule(sourceModule);

        if (!moduleRecords[sourceModule]) {
            await loadRecords(sourceModule, modName, rId, 1);
        }
    };

    const loadRecords = async (sourceModule, modName, rId, page) => {
        setModuleRecords(prev => ({
            ...prev,
            [sourceModule]: {
                ...prev[sourceModule],
                loading: true,
                records: page === 1 ? [] : (prev[sourceModule]?.records || [])
            }
        }));

        try {
            const pageSize = 10;
            const response = await axios.get(`/api/relations/details?module=${encodeURIComponent(modName)}&id=${rId}&sourceModule=${encodeURIComponent(sourceModule)}&page=${page}&pageSize=${pageSize}`);

            setModuleRecords(prev => ({
                ...prev,
                [sourceModule]: {
                    records: page === 1 ? response.data : [...(prev[sourceModule]?.records || []), ...response.data],
                    page: page,
                    hasMore: response.data.length === pageSize,
                    loading: false
                }
            }));
        } catch (err) {
            console.error(err);
            setModuleRecords(prev => ({
                ...prev,
                [sourceModule]: {
                    ...prev[sourceModule],
                    loading: false
                }
            }));
        }
    };

    const getChildDisplayValue = (childRec, childModule) => {
        if (!childRec) return '-';
        if (childRec.__displayValue) return childRec.__displayValue;
        if (childModule && childModule.fields) {
            const displayFields = childModule.fields
                .filter(f => f.isDisplayField)
                .sort((a, b) => a.orderNo - b.orderNo);
            if (displayFields.length > 0) {
                return displayFields
                    .map(f => childRec[`__display_${f.name}`] || childRec[f.name])
                    .filter(val => val !== undefined && val !== null && val !== '')
                    .join(' - ') || `Record #${childRec.id || childRec.Id}`;
            }
        }
        return childRec.name || childRec.title || childRec.label ||
            Object.keys(childRec)
                .filter(k => !k.startsWith('__') && typeof childRec[k] === 'string')
                .map(k => childRec[k])[0] ||
            `Record #${childRec.id || childRec.Id || ''}`;
    };

    const handleExpandRelationField = (fieldName) => {
        if (expandedModule === fieldName) {
            setExpandedModule(null);
        } else {
            setExpandedModule(fieldName);
        }
    };

    const renderFieldValue = (field, recordData) => {
        if (!recordData || !recordData.data) return <span className="text-muted">-</span>;
        
        const value = recordData.data[field.name];
        const displayValue = recordData.data[`__display_${field.name}`];
        
        if (field.type === 'checkbox') {
            return value ? (
                <span className="badge bg-success"><Icon name="check" size={14} className="me-1" /> {t('yes')}</span>
            ) : (
                <span className="badge bg-secondary"><Icon name="x" size={14} className="me-1" /> {t('no')}</span>
            );
        }

        if (field.type === 'image' && value) {
            const images = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
            return (
                <div className="d-flex flex-wrap gap-2 mt-2">
                    {images.map((img, idx) => {
                        let imgSrc = typeof img === 'string' ? img.trim() : img;
                        if (!imgSrc) return null;
                        if (imgSrc.startsWith('/')) imgSrc = HOST_URL + imgSrc;
                        return (
                            <div key={idx} className="position-relative d-inline-block" style={{ width: '120px', height: '120px' }}>
                                <img 
                                    src={imgSrc} 
                                    alt={field.label} 
                                    className="img-thumbnail shadow-sm w-100 h-100 object-fit-cover rounded" 
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => window.open(imgSrc, '_blank')}
                                    title={t('click_to_preview')}
                                />
                                <a 
                                    href={imgSrc} 
                                    download 
                                    className="btn btn-sm btn-dark position-absolute bottom-0 end-0 m-1 rounded-circle bg-opacity-75"
                                    onClick={e => e.stopPropagation()}
                                    title={t('download')}
                                    style={{ width: '28px', height: '28px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
                                    </svg>
                                </a>
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (field.type === 'file' && value) {
            const files = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
            return (
                <div className="d-flex flex-wrap gap-2 mt-2">
                    {files.map((f, idx) => {
                        let fileSrc = typeof f === 'string' ? f.trim() : f;
                        if (!fileSrc) return null;
                        if (fileSrc.startsWith('/')) fileSrc = HOST_URL + fileSrc;
                        const fileName = fileSrc.split('/').pop()?.split('\\').pop() || t('file');
                        return (
                            <div key={idx} className="btn-group shadow-sm">
                                <a 
                                    href={fileSrc} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="btn btn-outline-secondary d-flex align-items-center gap-2"
                                    title={t('click_to_preview')}
                                >
                                    <Icon name="attachment" size={16} className="me-2" />
                                    <span className="text-truncate" style={{ maxWidth: '200px' }}>{fileName}</span>
                                </a>
                                <a 
                                    href={fileSrc} 
                                    download
                                    className="btn btn-secondary d-flex align-items-center px-2"
                                    title={t('download')}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-download" viewBox="0 0 16 16">
                                      <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
                                      <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
                                    </svg>
                                </a>
                            </div>
                        );
                    })}
                </div>
            );
        }

        const linkData = recordData.data[`__links_${field.name}`];

        if (linkData && linkData.length > 0) {
            return (
                <div className="d-flex flex-wrap gap-1">
                    {linkData.map((link, idx) => (
                        <Link 
                            key={idx} 
                            to={`/modules/${link.moduleId}/records/${link.recordId}`}
                            className="badge badge-soft-primary text-decoration-none"
                        >
                            <Icon name="link" size={12} className="me-1" /> {link.display}
                        </Link>
                    ))}
                </div>
            );
        }

        if (displayValue) {
            return <span>{displayValue}</span>;
        }

        if (Array.isArray(value)) {
            return <span>{value.join(', ')}</span>;
        }

        return value ? <span>{value}</span> : <span className="text-muted">-</span>;
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

    if (error || !module || !record) {
        return (
            <div className="alert alert-danger shadow-sm">
                <h5 className="alert-heading">{error || t('record_not_found')}</h5>
                <p className="mb-0">{t('record_not_found_desc')}</p>
                <hr />
                <button className="btn btn-outline-danger" onClick={() => navigate(`/modules/${moduleId}/records`)}>
                    ← {t('back_to_records')}
                </button>
            </div>
        );
    }

    return (
        <div className="fade-in pb-5">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <button
                        className="btn btn-link mb-2 p-0 text-decoration-none text-primary d-flex align-items-center gap-2"
                        onClick={() => navigate(`/modules/${moduleId}/records`)}
                    >
                        <Icon name="arrowLeft" size={20} className="me-1" /> {t('back_to_records')}
                    </button>
                    <h1 className="display-6 mb-1 d-flex align-items-center gap-3">
                        <div className="text-primary me-3 me-md-4 d-flex align-items-center justify-content-center">
                            <Icon name="records" size={32} className="icon-theme" />
                        </div>
                        {t('record_details')} <span className="text-muted fs-4">#{record.id}</span>
                        {record.approvalStatus === 'Pending' && (
                            <span className="badge bg-warning text-dark fs-6 ms-2 d-flex align-items-center gap-2">
                                <Icon name="clock" size={16} /> {t('approval_pending') || 'Onay Bekliyor'}
                            </span>
                        )}
                        {record.approvalStatus === 'Approved' && (
                            <span className="badge bg-success fs-6 ms-2 d-flex align-items-center gap-2">
                                <Icon name="check" size={16} /> {t('approved') || 'Onaylandı'}
                            </span>
                        )}
                        {record.approvalStatus === 'Rejected' && (
                            <span className="badge bg-danger fs-6 ms-2 d-flex align-items-center gap-2">
                                <Icon name="x" size={16} /> {t('rejected') || 'Reddedildi'}
                            </span>
                        )}
                    </h1>
                    <p className="text-muted mb-0">{module.name} {t('module')}</p>
                </div>
            </div>

            {record.approvalStatus === 'Pending' && (
                <div className="alert alert-warning shadow-premium border-0 d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-4 gap-3 p-4 rounded-4 bg-opacity-10 glass">
                    <div className="d-flex align-items-center gap-3">
                        <div className="bg-warning bg-opacity-25 p-3 rounded-circle text-warning d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px' }}>
                            <Icon name="check" size={24} />
                        </div>
                        <div>
                            <h5 className="mb-1 fw-bold text-warning">{t('approval_action_required') || 'Onay İşlemi Gerekiyor'}</h5>
                            <p className="mb-0 text-muted small">{t('approval_action_desc') || 'Bu kayıt şu anda onay sürecinde. Lütfen kaydı inceleyip onaylayın veya reddedin.'}</p>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button 
                            className="btn btn-danger hover-lift d-flex align-items-center gap-2" 
                            onClick={handleReject}
                            disabled={actionLoading}
                        >
                            <Icon name="x" size={18} /> {t('reject') || 'Reddet'}
                        </button>
                        <button 
                            className="btn btn-success hover-lift d-flex align-items-center gap-2 shadow-sm" 
                            onClick={handleApprove}
                            disabled={actionLoading}
                        >
                            <Icon name="check" size={18} /> {t('approve') || 'Onayla'}
                        </button>
                    </div>
                </div>
            )}

            {/* Multi-Stage Approval Stepper */}
            {approvalHistory && approvalHistory.stages && approvalHistory.stages.length > 0 && (
                <div className="card shadow-premium border-0 mb-4 rounded-4 overflow-hidden bg-opacity-10 glass">
                    <style>{`
                        @keyframes pulse-warning {
                            0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.4); }
                            70% { box-shadow: 0 0 0 8px rgba(255, 193, 7, 0); }
                            100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
                        }
                        .pulse-border {
                            animation: pulse-warning 2s infinite;
                        }
                    `}</style>
                    <div className="card-header py-3 border-bottom bg-transparent d-flex align-items-center justify-content-between">
                        <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-warning">
                            <Icon name="flow" size={20} className="icon-theme animate-pulse" /> {t('approval_flow') || 'Onay Akışı ve Aşamaları'}
                        </h5>
                        <span className="badge bg-warning bg-opacity-20 text-warning px-2 py-1 rounded-pill fw-bold text-uppercase small" style={{ fontSize: '0.75rem' }}>
                            {t('stage') || 'Aşama'} {approvalHistory.currentStage} / {approvalHistory.stages.length}
                        </span>
                    </div>
                    <div className="card-body p-4">
                        <div className="row g-4 justify-content-center">
                            {approvalHistory.stages.map((stage, idx) => {
                                const isApproved = stage.status === 'Approved';
                                const isPending = stage.status === 'Pending';
                                const isWaiting = stage.status === 'Waiting';
                                const isRejected = stage.status === 'Rejected';
                                const isSkipped = stage.status === 'Skipped';

                                let statusColor = 'text-muted border-secondary opacity-50';
                                let bgBadge = 'bg-secondary bg-opacity-20 text-muted';
                                let iconName = 'clock';

                                if (isApproved) {
                                    statusColor = 'text-success border-success';
                                    bgBadge = 'bg-success bg-opacity-15 text-success';
                                    iconName = 'check';
                                } else if (isPending) {
                                    statusColor = 'text-warning border-warning pulse-border';
                                    bgBadge = 'bg-warning bg-opacity-15 text-warning';
                                    iconName = 'clock';
                                } else if (isRejected) {
                                    statusColor = 'text-danger border-danger';
                                    bgBadge = 'bg-danger bg-opacity-15 text-danger';
                                    iconName = 'x';
                                } else if (isSkipped) {
                                    statusColor = 'text-muted border-secondary opacity-30';
                                    bgBadge = 'bg-dark bg-opacity-20 text-muted';
                                    iconName = 'arrowRight';
                                }

                                const deadlineDate = stage.escalationDeadline ? new Date(stage.escalationDeadline) : null;
                                const isDeadlineExpired = deadlineDate && deadlineDate <= new Date();

                                return (
                                    <div key={stage.id} className="col-12 col-md-3 text-center position-relative">
                                        {/* Connector line between steps */}
                                        {idx > 0 && (
                                            <div 
                                                className="d-none d-md-block position-absolute start-0 top-0 translate-middle-y w-100" 
                                                style={{ 
                                                    height: '2px', 
                                                    background: isApproved ? 'hsl(var(--success))' : 'rgba(255, 255, 255, 0.1)', 
                                                    top: '24px', 
                                                    left: '-50%', 
                                                    zIndex: 0 
                                                }} 
                                            />
                                        )}

                                        <div className="d-flex flex-column align-items-center position-relative" style={{ zIndex: 1 }}>
                                            {/* Step Circle Icon */}
                                            <div className={`rounded-circle border border-2 d-flex align-items-center justify-content-center bg-dark ${statusColor} mb-2 shadow-sm`} style={{ width: '48px', height: '48px' }}>
                                                <Icon name={iconName} size={20} />
                                            </div>

                                            {/* Step Name & Details */}
                                            <h6 className="fw-bold mb-1 mt-1 text-foreground" style={{ fontSize: '0.9rem' }}>{stage.name}</h6>
                                            <span className={`badge ${bgBadge} px-2 py-0.5 rounded-pill mb-2 small`} style={{ fontSize: '0.65rem' }}>
                                                {stage.status === 'Pending' && (t('pending') || 'Onay Bekliyor')}
                                                {stage.status === 'Approved' && (t('approved') || 'Onaylandı')}
                                                {stage.status === 'Rejected' && (t('rejected') || 'Reddedildi')}
                                                {stage.status === 'Waiting' && (t('waiting') || 'Sırada')}
                                                {stage.status === 'Skipped' && (t('skipped') || 'Atlandı')}
                                            </span>

                                            {/* Assignee Information */}
                                            {stage.assignedToRoleName && (
                                                <p className="mb-1 text-muted small" style={{ fontSize: '0.75rem' }}>
                                                    <span className="text-secondary fw-bold">{t('role') || 'Rol'}:</span> {stage.assignedToRoleName}
                                                </p>
                                            )}

                                            {/* Timeout/Escalation Status */}
                                            {stage.status === 'Pending' && stage.escalationDeadline && (
                                                <div className="mt-1">
                                                    <small className={`fw-bold ${isDeadlineExpired ? 'text-danger' : 'text-muted'}`} style={{ fontSize: '0.7rem' }}>
                                                        <Icon name="clock" size={10} className="me-1" />
                                                        {isDeadlineExpired ? (
                                                            t('expired') || 'Süre Doldu'
                                                        ) : (
                                                            `${t('remaining') || 'Kalan'}: ${Math.max(0, Math.round((deadlineDate - new Date()) / (1000 * 60 * 60)))} ${t('hours') || 'saat'}`
                                                        )}
                                                    </small>
                                                </div>
                                            )}

                                            {/* Escalated Tag */}
                                            {stage.escalated && (
                                                <span className="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-35 mt-1 small" style={{ fontSize: '0.65rem' }}>
                                                    <Icon name="alert" size={10} className="me-1" /> {t('escalated') || 'Eskale Edildi'}
                                                </span>
                                            )}

                                            {/* Approver Comments */}
                                            {stage.comments && (
                                                <div className="alert bg-dark bg-opacity-40 border border-secondary border-opacity-10 mt-2 p-2 rounded-3 text-start small w-100" style={{ fontSize: '0.75rem', maxWidth: '200px' }}>
                                                    <span className="fw-bold text-danger">{t('reason') || 'Sebep'}:</span> {stage.comments}
                                                </div>
                                            )}

                                            {/* Resolved By Info */}
                                            {stage.resolvedByUsername && (
                                                <small className="text-muted mt-1 opacity-75" style={{ fontSize: '0.7rem' }}>
                                                    {t('by') || 'Tarafından'}: @{stage.resolvedByUsername}
                                                </small>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-header py-3 border-bottom">
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                <Icon name="records" size={20} className="opacity-75" /> {t('primary_details')}
                            </h5>
                        </div>
                        <div className="card-body p-0">
                            {fields.filter(field => field.type !== 'relations').length === 0 ? (
                                <div className="p-4 text-center text-muted">
                                    {t('no_primary_fields')}
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush">
                                    {fields.filter(field => field.type !== 'relations').map(field => (
                                        <li key={field.id} className="list-group-item d-flex justify-content-between align-items-start py-3">
                                            <div className="ms-2 me-auto">
                                                <div className="fw-bold text-muted small text-uppercase mb-1">{field.label}</div>
                                                <div className="fs-6 text-foreground">{renderFieldValue(field, record)}</div>
                                            </div>
                                        </li>
                                    ))}
                                    <li className="list-group-item d-flex justify-content-between align-items-start py-3">
                                         <div className="ms-2 me-auto">
                                                <div className="fw-bold text-muted small text-uppercase mb-1">{t('created_at')}</div>
                                                <div className="fs-6 text-foreground">{new Date(record.createdAt).toLocaleString()}</div>
                                          </div>
                                    </li>
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-header py-3 border-bottom">
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                <Icon name="link" size={20} className="opacity-75" /> {t('related_data')}
                            </h5>
                        </div>
                        <div className="card-body p-4">
                            {loadingSummary ? (
                                <div className="text-center py-4">
                                     <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                </div>
                            ) : (summary.length === 0 && fields.filter(f => f.type === 'relations').length === 0) ? (
                                <div className="text-center py-5 text-muted">
                                    <div className="text-primary me-3 d-flex align-items-center justify-content-center">
                                        <Icon name="settings" size={24} className="icon-theme" strokeWidth={2} />
                                    </div>
                                    <p className="mb-0 mt-2">{t('no_references_found') || 'İlişkili veri bulunamadı.'}</p>
                                </div>
                            ) : (
                                <div className="accordion rounded shadow-sm" id="relationsAccordion">
                                    {/* 1. Sub-grids (Relations fields on the parent) */}
                                    {fields.filter(f => f.type === 'relations').map((field) => {
                                        const targetModuleName = field.options ? field.options.replace(/['"]+/g, '') : '';
                                        const targetModule = allModules.find(m => m.name.toLowerCase() === targetModuleName.toLowerCase());
                                        const childRecords = record.data?.[field.name] || [];

                                        return (
                                            <div className="accordion-item border-0 mb-2 rounded overflow-hidden" key={field.name}>
                                                <h2 className="accordion-header">
                                                    <button
                                                        className={`accordion-button bg-surface bg-opacity-30 border-theme-accent ${expandedModule === field.name ? 'text-primary fw-bold' : 'text-foreground collapsed'}`}
                                                        type="button"
                                                        onClick={() => handleExpandRelationField(field.name)}
                                                        style={{ boxShadow: 'none' }}
                                                    >
                                                        <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                                                            <span>
                                                                <Icon name="list" size={18} className="me-2 opacity-100 icon-theme text-primary" />
                                                                {field.label}
                                                            </span>
                                                            <span className={`badge ${expandedModule === field.name ? 'bg-primary' : 'bg-surface bg-opacity-50 text-muted'} rounded-pill`}>
                                                                {childRecords.length} {t('entries') || 'Kayıt'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </h2>
                                                <div className={`accordion-collapse collapse ${expandedModule === field.name ? 'show' : ''}`}>
                                                    <div className="accordion-body p-0 border-top">
                                                        <div className="list-group list-group-flush">
                                                            {childRecords.length === 0 ? (
                                                                <div className="p-4 text-center text-muted small">
                                                                    {t('no_records_found') || 'Kayıt bulunamadı.'}
                                                                </div>
                                                            ) : (
                                                                childRecords.map((child) => {
                                                                    const childId = child.id || child.Id;
                                                                    const displayVal = getChildDisplayValue(child, targetModule);
                                                                    return (
                                                                        <div key={childId} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-0 border-bottom">
                                                                            <div>
                                                                                <span className="text-muted small me-3">#{childId}</span>
                                                                                {targetModule ? (
                                                                                    <Link 
                                                                                        to={`/modules/${targetModule.id}/records/${childId}`}
                                                                                        className="fw-bold text-primary text-decoration-none"
                                                                                    >
                                                                                        {displayVal}
                                                                                    </Link>
                                                                                ) : (
                                                                                    <span className="fw-bold text-foreground">{displayVal}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <span className="badge bg-primary-transparent text-primary px-2 py-1 d-flex align-items-center gap-1" style={{ fontSize: '0.75rem' }}>
                                                                                    <Icon name="list" size={12} /> <small>{t('sub_grid_record') || 'Alt Tablo Kaydı'}</small>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* 2. Standard incoming relations (filtered to exclude modules already shown as subgrids) */}
                                    {summary.filter(item => {
                                        const isAlreadySubgrid = fields.some(f => {
                                            if (f.type !== 'relations') return false;
                                            const targetModuleName = f.options ? f.options.replace(/['"]+/g, '') : '';
                                            return targetModuleName.toLowerCase() === item.module.toLowerCase();
                                        });
                                        return !isAlreadySubgrid;
                                    }).map((item, index) => (
                                        <div className="accordion-item border-0 mb-2 rounded overflow-hidden" key={item.module}>
                                            <h2 className="accordion-header">
                                                <button
                                                    className={`accordion-button bg-surface bg-opacity-30 border-theme-accent ${expandedModule === item.module ? 'text-primary fw-bold' : 'text-foreground collapsed'}`}
                                                    type="button"
                                                    onClick={() => handleExpand(item.module)}
                                                    style={{ boxShadow: 'none' }}
                                                >
                                                    <div className="d-flex w-100 justify-content-between align-items-center pe-3">
                                                        <span>
                                                            <Icon name="box" size={18} className="me-2 opacity-100 icon-theme" />
                                                            {item.module}
                                                        </span>
                                                        <span className={`badge ${expandedModule === item.module ? 'bg-primary' : 'bg-surface bg-opacity-50 text-muted'} rounded-pill`}>
                                                            {item.count} {t('entries')}
                                                        </span>
                                                    </div>
                                                </button>
                                            </h2>
                                            <div className={`accordion-collapse collapse ${expandedModule === item.module ? 'show' : ''}`}>
                                                <div className="accordion-body p-0 border-top">
                                                    <div className="list-group list-group-flush">
                                                        {(moduleRecords[item.module]?.records || []).map(rel => {
                                                            const targetModule = allModules.find(m => m.name === item.module);
                                                            return (
                                                                <div key={rel.recordId || Math.random()} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 border-0 border-bottom">
                                                                    <div>
                                                                        <span className="text-muted small me-3">#{rel.recordId}</span>
                                                                        {targetModule ? (
                                                                            <Link 
                                                                                to={`/modules/${targetModule.id}/records/${rel.recordId}`}
                                                                                className="fw-bold text-primary text-decoration-none"
                                                                            >
                                                                                {rel.display}
                                                                            </Link>
                                                                        ) : (
                                                                            <span className="fw-bold text-foreground">{rel.display}</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <span className="badge bg-surface bg-opacity-50 text-muted border border-theme-accent px-2 py-1 d-flex align-items-center gap-1">
                                                                            <Icon name="link" size={12} /> <small>{t('linked_via_relation')}</small>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {moduleRecords[item.module]?.loading && (
                                                        <div className="text-center py-3 bg-surface bg-opacity-20 border-top border-theme-accent">
                                                            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                                        </div>
                                                    )}
                                                    
                                                    {!moduleRecords[item.module]?.loading && moduleRecords[item.module]?.hasMore && (
                                                        <div className="p-3 text-center bg-surface bg-opacity-20 border-top border-theme-accent">
                                                            <button
                                                                className="btn btn-sm btn-outline-primary px-4 rounded-pill shadow-sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    loadRecords(item.module, module.name, record.id, (moduleRecords[item.module]?.page || 1) + 1);
                                                                }}
                                                            >
                                                                ⬇ {t('load_more')}
                                                            </button>
                                                        </div>
                                                    )}
                                                    
                                                    {!moduleRecords[item.module]?.loading && !moduleRecords[item.module]?.hasMore && (moduleRecords[item.module]?.records?.length > 0) && (
                                                        <div className="p-2 text-center bg-surface bg-opacity-20 border-top border-theme-accent">
                                                            <small className="text-muted small fw-bold opacity-70">{t('no_more_records')}</small>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RecordDetailPage;
