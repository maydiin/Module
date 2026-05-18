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
                fetchSummary(moduleData.name, recordData.id);
            }
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async (moduleName, rId) => {
        try {
            setLoadingSummary(true);
            const response = await axios.get(`/api/relations/summary?module=${encodeURIComponent(moduleName)}&id=${rId}`);
            const summaryData = response.data || [];
            setSummary(summaryData);
            
            // Auto expand the first module containing linked records to show at least something initially
            if (summaryData.length > 0) {
               handleExpand(summaryData[0].module, moduleName, rId);
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

            <div className="row g-4 mb-4">
                <div className="col-lg-6">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-header py-3 border-bottom">
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                <Icon name="records" size={20} className="opacity-75" /> {t('primary_details')}
                            </h5>
                        </div>
                        <div className="card-body p-0">
                            {fields.length === 0 ? (
                                <div className="p-4 text-center text-muted">
                                    {t('no_primary_fields')}
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush">
                                    {fields.map(field => (
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
                            ) : summary.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <div className="text-primary me-3 d-flex align-items-center justify-content-center">
                                        <Icon name="settings" size={24} className="icon-theme" strokeWidth={2} />
                                    </div>
                                    <p className="mb-0 mt-2">{t('no_references_found')}</p>
                                </div>
                            ) : (
                                <div className="accordion rounded shadow-sm" id="relationsAccordion">
                                    {summary.map((item, index) => (
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
