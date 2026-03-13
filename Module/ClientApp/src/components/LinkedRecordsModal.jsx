import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules } from '../services/api';
import axios from 'axios';

function LinkedRecordsModal({ moduleName, recordId, onClose }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [summary, setSummary] = useState([]);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [error, setError] = useState('');
    const [expandedModule, setExpandedModule] = useState(null);
    const [moduleRecords, setModuleRecords] = useState({}); // { moduleName: { records: [], page: 1, hasMore: true, loading: false } }
    const [allModules, setAllModules] = useState([]);

    useEffect(() => {
        getModules().then(res => setAllModules(res || [])).catch(console.error);
    }, []);

    useEffect(() => {
        const fetchSummary = async () => {
            if (!moduleName || !recordId) return;

            try {
                setLoadingSummary(true);
                const response = await axios.get(`/api/relations/summary?module=${encodeURIComponent(moduleName)}&id=${recordId}`);
                setSummary(response.data || []);
            } catch (err) {
                console.error(err);
                setError(t('error'));
            } finally {
                setLoadingSummary(false);
            }
        };

        fetchSummary();
    }, [moduleName, recordId, t]);

    const handleExpand = async (sourceModule) => {
        if (expandedModule === sourceModule) {
            setExpandedModule(null);
            return;
        }

        setExpandedModule(sourceModule);

        if (!moduleRecords[sourceModule]) {
            await loadRecords(sourceModule, 1);
        }
    };

    const loadRecords = async (sourceModule, page) => {
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
            const response = await axios.get(`/api/relations/details?module=${encodeURIComponent(moduleName)}&id=${recordId}&sourceModule=${encodeURIComponent(sourceModule)}&page=${page}&pageSize=${pageSize}`);

            setModuleRecords(prev => ({
                ...prev,
                [sourceModule]: {
                    records: page === 1 ? response.data : [...prev[sourceModule].records, ...response.data],
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

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content shadow-lg">
                    <div className="modal-header bg-info text-white">
                        <h5 className="modal-title">📎 {t('linked_records_for')} #{recordId}</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        {loadingSummary && (
                            <div className="text-center py-4">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="mt-2 text-muted">{t('loading')}</p>
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-danger">{error}</div>
                        )}

                        {!loadingSummary && !error && summary.length === 0 && (
                            <div className="text-center py-4 text-muted">
                                <p className="mb-0">{t('no_references_found')}</p>
                            </div>
                        )}

                        {!loadingSummary && !error && (
                            <div className="accordion" id="relationsAccordion">
                                {summary.map(item => (
                                    <div className="accordion-item" key={item.module}>
                                        <h2 className="accordion-header">
                                            <button
                                                className={`accordion-button ${expandedModule === item.module ? '' : 'collapsed'}`}
                                                type="button"
                                                onClick={() => handleExpand(item.module)}
                                            >
                                                <span className="badge bg-secondary me-2">{item.module}</span>
                                                {item.count} {t('records_count')}
                                            </button>
                                        </h2>
                                        <div className={`accordion-collapse collapse ${expandedModule === item.module ? 'show' : ''}`}>
                                            <div className="accordion-body p-0">
                                                <div className="list-group list-group-flush">
                                                    {(moduleRecords[item.module]?.records || []).map(rel => {
                                                        const targetModule = allModules.find(m => m.name === item.module);
                                                        return (
                                                            <div key={rel.recordId || Math.random()} className="list-group-item d-flex justify-content-between align-items-center">
                                                                    <div>
                                                                        <span className="text-muted me-2">#{rel.recordId}</span>
                                                                        {targetModule ? (
                                                                            <Link 
                                                                                to={`/modules/${targetModule.id}/records/${rel.recordId}`}
                                                                                onClick={onClose}
                                                                                className="fw-bold text-primary text-decoration-none"
                                                                            >
                                                                                {rel.display}
                                                                            </Link>
                                                                        ) : (
                                                                            <strong>{rel.display}</strong>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <span className="badge bg-light text-muted border px-2 py-1">
                                                                            <small>🔗 {t('linked_via_relation')}</small>
                                                                        </span>
                                                                    </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {moduleRecords[item.module]?.loading && (
                                                    <div className="text-center py-2">
                                                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                                    </div>
                                                )}

                                                {!moduleRecords[item.module]?.loading && moduleRecords[item.module]?.hasMore && (
                                                    <div className="p-2 text-center">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                loadRecords(item.module, (moduleRecords[item.module]?.page || 1) + 1);
                                                            }}
                                                        >
                                                            {t('load_more')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>{t('close')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LinkedRecordsModal;
