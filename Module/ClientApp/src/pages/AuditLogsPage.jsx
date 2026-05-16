import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuditLogs } from '../services/api';
import { useTenant } from '../components/TenantContext';
import { Modal, Button } from 'react-bootstrap';
import Icon from '../components/Icon';

const ACTION_BADGES = {
    Create: { bg: 'linear-gradient(135deg, #059669, #10b981)', icon: 'plus' },
    Update: { bg: 'linear-gradient(135deg, #2563eb, #3b82f6)', icon: 'edit' },
    Delete: { bg: 'linear-gradient(135deg, #dc2626, #ef4444)', icon: 'delete' },
    Login: { bg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', icon: 'settings' },
    Register: { bg: 'linear-gradient(135deg, #d97706, #f59e0b)', icon: 'records' },
    Default: { bg: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', icon: 'check' }
};

const ENTITY_ICONS = {
    Module: 'box',
    Record: 'records',
    Field: 'fields',
    Role: 'settings',
    User: 'settings',
    Auth: 'settings',
};

function AuditLogsPage() {
    const { t } = useTranslation();
    const { selectedTenantId } = useTenant();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Filters
    const [actionFilter, setActionFilter] = useState('');
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);

    const handleShowModal = (log) => {
        setSelectedLog(log);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedLog(null);
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, pageSize };
            if (actionFilter) params.action = actionFilter;
            if (entityTypeFilter) params.entityType = entityTypeFilter;
            if (searchQuery) params.search = searchQuery;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const result = await getAuditLogs(params);
            setLogs(result.data);
            setTotalPages(result.totalPages);
            setTotalCount(result.totalCount);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, actionFilter, entityTypeFilter, searchQuery, startDate, endDate, selectedTenantId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Reset to page 1 when tenant changes
    useEffect(() => {
        setPage(1);
    }, [selectedTenantId]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchLogs();
    };

    const clearFilters = () => {
        setActionFilter('');
        setEntityTypeFilter('');
        setSearchQuery('');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleString();
    };

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="text-center mb-4 mb-md-5 stagger-in">
                <h1 className="display-4 fw-bold mb-2 text-gradient d-flex align-items-center justify-content-center gap-2 gap-md-3 flex-wrap">
                    <Icon name="records" size={40} className="icon-theme" />
                    {t('audit_logs_title')}
                </h1>
                <p className="text-muted fw-medium" style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}>{t('audit_logs_subtitle')}</p>
            </div>

            {/* Filters Card */}
            <div className="card glass-card shadow-premium border-0 mb-4 overflow-hidden stagger-in">
                <div className="card-body p-4 p-md-5 bg-surface bg-opacity-10">
                    <form onSubmit={handleSearch}>
                        <div className="row g-3">
                            {/* Search */}
                            <div className="col-12 col-sm-12 col-md-4">
                                <div className="input-group">
                                    <div className="input-group-text bg-transparent border-0 opacity-50 px-3 d-flex align-items-center justify-content-center">
                                        <Icon name="search" size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder={t('audit_search_placeholder')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ borderLeft: '1px solid hsla(var(--primary), 0.1) !important' }}
                                    />
                                </div>
                            </div>

                            {/* Action Filter */}
                            <div className="col-6 col-sm-4 col-md-2">
                                <select
                                    className="form-select"
                                    value={actionFilter}
                                    onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                                >
                                    <option value="">{t('audit_all_actions')}</option>
                                    <option value="Create">{t('audit_action_create')}</option>
                                    <option value="Update">{t('audit_action_update')}</option>
                                    <option value="Delete">{t('audit_action_delete')}</option>
                                    <option value="Login">{t('audit_action_login')}</option>
                                    <option value="Register">{t('audit_action_register')}</option>
                                </select>
                            </div>

                            {/* Entity Type Filter */}
                            <div className="col-6 col-sm-4 col-md-2">
                                <select
                                    className="form-select"
                                    value={entityTypeFilter}
                                    onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1); }}
                                >
                                    <option value="">{t('audit_all_entities')}</option>
                                    <option value="Module">Module</option>
                                    <option value="Record">Record</option>
                                    <option value="Field">Field</option>
                                    <option value="Role">Role</option>
                                    <option value="User">User</option>
                                    <option value="Auth">Auth</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div className="col-6 col-sm-4 col-md-2">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    placeholder={t('audit_start_date')}
                                />
                            </div>
                            <div className="col-6 col-sm-4 col-md-2">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    placeholder={t('audit_end_date')}
                                />
                            </div>
                        </div>

                        <div className="mt-4 d-flex align-items-center flex-wrap gap-3">
                            <button type="submit" className="btn btn-primary rounded-pill px-4 px-md-5 shadow-lg hover-lift">
                                {t('apply_filters')}
                            </button>
                            <button type="button" className="btn btn-blur rounded-pill px-4 hover-lift" onClick={clearFilters}>
                                {t('clear_filters')}
                            </button>
                            <div className="ms-auto glass-pill px-3 px-md-4 py-2 text-primary fw-bold small">
                                {t('audit_total_records', { count: totalCount })}
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Logs Table */}
            <div className="table-container border-0 shadow-premium fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">{t('loading')}</span>
                            </div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-5 opacity-25">
                            <Icon name="records" size={64} className="icon-theme" strokeWidth={1} />
                            <p className="text-muted mt-3">{t('audit_no_logs')}</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="bg-surface">
                                    <tr className="border-bottom">
                                        <th className="ps-4 py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_time')}</th>
                                        <th className="py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_user')}</th>
                                        <th className="py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_action')}</th>
                                        <th className="py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_entity_type')}</th>
                                        <th className="py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_entity_name')}</th>
                                        <th className="py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">{t('audit_col_details')}</th>
                                        <th className="pe-4 py-4 text-primary small fw-bold text-uppercase tracking-wider border-0">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        const badge = ACTION_BADGES[log.action] || ACTION_BADGES.Default;
                                        const entityIcon = ENTITY_ICONS[log.entityType] || '📌';

                                        return (
                                            <tr key={log.id} className="border-bottom">
                                                <td className="ps-4 py-3">
                                                    <span className="text-muted small">{formatDate(log.timestamp)}</span>
                                                </td>
                                                <td className="py-3">
                                                    <span className="fw-medium">{log.username || '—'}</span>
                                                </td>
                                                <td className="py-3">
                                                    <span
                                                        className={`badge rounded-pill text-white px-3 py-2 shadow-sm ${!ACTION_BADGES[log.action] ? 'badge-outline-theme' : ''}`}
                                                        style={{ 
                                                            background: badge.bg, 
                                                            fontSize: '0.725rem',
                                                            border: 'none'
                                                        }}
                                                    >
                                                        <Icon name={badge.icon} size={14} color="white" className="me-1" /> {t(`audit_action_${log.action.toLowerCase()}`)}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className="d-flex align-items-center gap-2">
                                                        <Icon name={ENTITY_ICONS[log.entityType] || 'records'} size={16} className="text-muted" />
                                                        <span className="fw-medium">{log.entityType}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <div className="d-flex align-items-center">
                                                        <span className="text-truncate d-inline-block me-2" style={{ maxWidth: '150px' }}>
                                                            {log.entityName || '—'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="d-flex align-items-center justify-content-between">
                                                        {log.details ? (
                                                            <span className="text-muted small text-truncate d-inline-block me-2" style={{ maxWidth: '200px' }}>
                                                                {log.details}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted me-2">—</span>
                                                        )}
                                                        {(log.details || log.entityName?.length > 20) && (
                                                            <button 
                                                                className="btn btn-sm btn-blur rounded-circle shadow-sm p-1 d-flex align-items-center justify-content-center hover-lift"
                                                                onClick={() => handleShowModal(log)}
                                                                title={t('view_details')}
                                                                style={{ width: '32px', height: '32px' }}
                                                            >
                                                                <Icon name="eye" size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="pe-4 py-3">
                                                    <code className="small">{log.ipAddress || '—'}</code>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="card-footer bg-transparent border-top-0 d-flex flex-wrap justify-content-between align-items-center px-3 px-md-4 py-4 mt-2 gap-3">
                        <span className="text-muted small fw-bold opacity-75">
                            {t('page_of', { page, totalPages })}
                        </span>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-blur rounded-pill px-3 px-md-4 shadow-sm hover-lift"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <Icon name="arrowLeft" size={14} className="me-1" /> {t('previous')}
                            </button>
                            <button
                                className="btn btn-primary rounded-pill px-3 px-md-4 shadow-lg hover-lift"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                {t('next')} <Icon name="arrowLeft" size={14} className="ms-1 rotate-180" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            <Modal show={showModal} onHide={handleCloseModal} size="lg" centered className="glass-modal">
                <Modal.Header closeButton className="border-bottom-0 bg-transparent p-4">
                    <Modal.Title className="h4 mb-0 text-primary fw-bold d-flex align-items-center gap-2">
                        <Icon name="records" size={24} className="icon-theme" />
                        {t('audit_log_details')}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-4 pt-0">
                    {selectedLog && (
                        <div className="d-flex flex-column gap-3">
                            <div>
                                <h6 className="text-primary mb-1 text-uppercase small fw-extrabold tracking-wider">{t('audit_col_entity_name')}</h6>
                                <div className="p-3 bg-surface border border-theme-accent rounded text-break fw-medium">
                                    {selectedLog.entityName || '—'}
                                </div>
                            </div>
                            
                             <div>
                                <h6 className="text-primary mb-2 text-uppercase small fw-extrabold tracking-wider">{t('audit_col_details')}</h6>
                                <div className="p-4 bg-glass border-theme-accent rounded-4 overflow-auto shadow-inner" style={{ maxHeight: '400px' }}>
                                    <pre className="mb-0 text-foreground" style={{ whiteSpace: 'pre-wrap', fontFamily: "'Fira Code', 'Courier New', monospace", fontSize: '0.9rem', lineHeight: '1.6' }}>
                                        {(() => {
                                            if (!selectedLog.details) return '—';
                                            try {
                                                // Try to format as JSON if it is a JSON string
                                                const parsed = JSON.parse(selectedLog.details);
                                                return JSON.stringify(parsed, null, 2);
                                            } catch (e) {
                                                // If not JSON, just show the raw string
                                                return selectedLog.details;
                                            }
                                        })()}
                                    </pre>
                                </div>
                            </div>
                            
                            <div className="row mt-2">
                                <div className="col-md-4">
                                    <span className="text-muted small d-block">{t('audit_col_time')}</span>
                                    <span className="fw-medium">{formatDate(selectedLog.timestamp)}</span>
                                </div>
                                <div className="col-md-4">
                                    <span className="text-muted small d-block">{t('audit_col_user')}</span>
                                    <span className="fw-medium">{selectedLog.username || '—'}</span>
                                </div>
                                <div className="col-md-4">
                                    <span className="text-muted small d-block">IP</span>
                                    <span className="fw-medium">{selectedLog.ipAddress || '—'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-top-0 bg-transparent p-4 pt-0">
                    <Button variant="outline-primary" className="rounded-pill px-5 hover-lift fw-bold" onClick={handleCloseModal}>
                        {t('close')}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default AuditLogsPage;
