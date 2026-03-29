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
        <div className="modal fade show d-block glass-modal" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                <div className="modal-content border-0 shadow-xl overflow-hidden">
                    <div className="modal-header modal-header-premium border-0">
                        <h5 className="modal-title text-gradient fw-800 fs-4">📎 {t('linked_records_for')} #{recordId}</h5>
                        <button type="button" className="btn-close btn-close-premium" onClick={onClose}></button>
                    </div>
                    <div className="modal-body modal-body-premium" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        {loadingSummary && (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary mb-3" role="status"></div>
                                <p className="text-muted fw-medium">{t('loading')}</p>
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-danger glass border-danger border-opacity-20 shadow-sm">{error}</div>
                        )}

                        {!loadingSummary && !error && summary.length === 0 && (
                            <div className="text-center py-5 text-muted opacity-50">
                                <div className="fs-1 mb-3">🔍</div>
                                <p className="mb-0 fw-medium">{t('no_references_found')}</p>
                            </div>
                        )}

                        {!loadingSummary && !error && (
                            <div className="accordion accordion-flush" id="relationsAccordion">
                                {summary.map(item => (
                                    <div className="accordion-item mb-3 border rounded-4 overflow-hidden shadow-sm" key={item.module}>
                                        <h2 className="accordion-header">
                                            <button
                                                className={`accordion-button py-3 px-4 fw-bold ${expandedModule === item.module ? 'bg-primary bg-opacity-5 text-primary' : 'collapsed bg-white'}`}
                                                type="button"
                                                onClick={() => handleExpand(item.module)}
                                            >
                                                <span className="badge badge-outline-theme me-3 px-3">{item.module}</span>
                                                <span className="fw-800">{item.count}</span>
                                                <span className="ms-2 text-muted fw-normal">{t('records_count')}</span>
                                            </button>
                                        </h2>
                                        <div className={`accordion-collapse collapse ${expandedModule === item.module ? 'show' : ''}`}>
                                            <div className="accordion-body p-0 border-top border-theme-accent">
                                                <div className="list-group list-group-flush">
                                                    {(moduleRecords[item.module]?.records || []).map(rel => {
                                                        const targetModule = allModules.find(m => m.name === item.module);
                                                        return (
                                                            <div key={rel.recordId || Math.random()} className="list-group-item d-flex justify-content-between align-items-center py-3 px-4 hover-bg-theme">
                                                                    <div>
                                                                        <span className="text-muted me-3 fw-bold small">#{rel.recordId}</span>
                                                                        {targetModule ? (
                                                                            <Link 
                                                                                to={`/modules/${targetModule.id}/records/${rel.recordId}`}
                                                                                onClick={onClose}
                                                                                className="fw-bold text-primary text-decoration-none"
                                                                            >
                                                                                {rel.display}
                                                                            </Link>
                                                                        ) : (
                                                                            <strong className="text-foreground">{rel.display}</strong>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <span className="badge bg-light text-muted border-0 px-2 py-1 small opacity-75">
                                                                            🔗 {t('linked_via_relation')}
                                                                        </span>
                                                                    </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {moduleRecords[item.module]?.loading && (
                                                    <div className="text-center py-3">
                                                        <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                                                    </div>
                                                )}

                                                {!moduleRecords[item.module]?.loading && moduleRecords[item.module]?.hasMore && (
                                                    <div className="p-3 text-center bg-light bg-opacity-50">
                                                        <button
                                                            className="btn btn-sm btn-blur px-4 fw-bold"
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
                    <div className="modal-footer modal-footer-premium border-0">
                        <button type="button" className="btn btn-blur px-5 shadow-sm" onClick={onClose}>{t('close')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LinkedRecordsModal;
