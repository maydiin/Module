import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuditLogs } from '../services/api';
import { useTenant } from '../components/TenantContext';

const ACTION_BADGES = {
    Create: { bg: 'linear-gradient(135deg, #10b981, #059669)', icon: '➕' },
    Update: { bg: 'linear-gradient(135deg, #3b82f6, #2563eb)', icon: '✏️' },
    Delete: { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '🗑️' },
    Login: { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', icon: '🔐' },
    Register: { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '📝' },
};

const ENTITY_ICONS = {
    Module: '📦',
    Record: '📄',
    Field: '🔧',
    Role: '🛡️',
    User: '👤',
    Auth: '🔑',
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
            <div className="text-center mb-5">
                <h1 className="display-6 fw-bold mb-2">
                    <span className="me-2">📋</span>
                    {t('audit_logs_title')}
                </h1>
                <p className="text-muted fs-6">{t('audit_logs_subtitle')}</p>
            </div>

            {/* Filters Card */}
            <div className="card glass border-0 shadow-sm mb-4">
                <div className="card-body p-4">
                    <form onSubmit={handleSearch}>
                        <div className="row g-3">
                            {/* Search */}
                            <div className="col-md-4">
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0">🔍</span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder={t('audit_search_placeholder')}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Action Filter */}
                            <div className="col-md-2">
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
                            <div className="col-md-2">
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
                            <div className="col-md-2">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                                    placeholder={t('audit_start_date')}
                                />
                            </div>
                            <div className="col-md-2">
                                <input
                                    type="date"
                                    className="form-control"
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                                    placeholder={t('audit_end_date')}
                                />
                            </div>
                        </div>

                        <div className="mt-3 d-flex gap-2">
                            <button type="submit" className="btn btn-primary rounded-pill px-4">
                                {t('apply_filters')}
                            </button>
                            <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={clearFilters}>
                                {t('clear_filters')}
                            </button>
                            <span className="ms-auto text-muted small align-self-center">
                                {t('audit_total_records', { count: totalCount })}
                            </span>
                        </div>
                    </form>
                </div>
            </div>

            {/* Logs Table */}
            <div className="card glass border-0 shadow-sm">
                <div className="card-body p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">{t('loading')}</span>
                            </div>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-5">
                            <span className="display-4">📋</span>
                            <p className="text-muted mt-3">{t('audit_no_logs')}</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr className="border-bottom" style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                        <th className="ps-4 py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_time')}</th>
                                        <th className="py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_user')}</th>
                                        <th className="py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_action')}</th>
                                        <th className="py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_entity_type')}</th>
                                        <th className="py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_entity_name')}</th>
                                        <th className="py-3 text-muted small fw-semibold text-uppercase">{t('audit_col_details')}</th>
                                        <th className="pe-4 py-3 text-muted small fw-semibold text-uppercase">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => {
                                        const badge = ACTION_BADGES[log.action] || { bg: '#6b7280', icon: '•' };
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
                                                        className="badge rounded-pill text-white px-3 py-2"
                                                        style={{ background: badge.bg, fontSize: '0.75rem' }}
                                                    >
                                                        {badge.icon} {t(`audit_action_${log.action.toLowerCase()}`)}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className="d-flex align-items-center gap-1">
                                                        <span>{entityIcon}</span>
                                                        <span className="fw-medium">{log.entityType}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    <span className="text-truncate d-inline-block" style={{ maxWidth: '200px' }}>
                                                        {log.entityName || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-3">
                                                    {log.details ? (
                                                        <span
                                                            className="text-muted small text-truncate d-inline-block"
                                                            style={{ maxWidth: '250px' }}
                                                            title={log.details}
                                                        >
                                                            {log.details}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">—</span>
                                                    )}
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
                    <div className="card-footer bg-white border-top d-flex justify-content-between align-items-center px-4 py-3">
                        <span className="text-muted small">
                            {t('page_of', { page, totalPages })}
                        </span>
                        <div className="btn-group">
                            <button
                                className="btn btn-sm btn-outline-primary rounded-start-pill px-3"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                {t('previous')}
                            </button>
                            <button
                                className="btn btn-sm btn-outline-primary rounded-end-pill px-3"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                {t('next')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AuditLogsPage;
