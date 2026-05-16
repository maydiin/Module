import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    getDashboardWidgets, createDashboardWidget, updateDashboardWidget,
    deleteDashboardWidget, getDashboardWidgetData, getModules, getFields
} from '../services/api';
import { useTenant } from '../components/TenantContext';
import Icon from '../components/Icon';
import ConfirmModal from '../components/ConfirmModal';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#14b8a6'];

const WIDGET_ICON_MAP = {
    stat_card: 'barChart',
    bar_chart: 'barChart',
    pie_chart: 'barChart',
    line_chart: 'barChart',
    recent_records: 'records',
};

const WIDGET_ACCENT = [
    { solid: '#6366f1', light: 'rgba(99,102,241,0.12)', glow: 'rgba(99,102,241,0.25)', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)' },
    { solid: '#ec4899', light: 'rgba(236,72,153,0.12)', glow: 'rgba(236,72,153,0.25)', grad: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
    { solid: '#f97316', light: 'rgba(249,115,22,0.12)',  glow: 'rgba(249,115,22,0.25)',  grad: 'linear-gradient(135deg,#f97316,#eab308)' },
    { solid: '#22c55e', light: 'rgba(34,197,94,0.12)',   glow: 'rgba(34,197,94,0.25)',   grad: 'linear-gradient(135deg,#22c55e,#0ea5e9)' },
    { solid: '#0ea5e9', light: 'rgba(14,165,233,0.12)',  glow: 'rgba(14,165,233,0.25)',  grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
    { solid: '#a855f7', light: 'rgba(168,85,247,0.12)',  glow: 'rgba(168,85,247,0.25)',  grad: 'linear-gradient(135deg,#a855f7,#ec4899)' },
];

const TOOLTIP_STYLE = {
    backgroundColor: 'hsla(var(--background), 0.95)',
    borderRadius: '12px',
    border: '1px solid hsla(var(--foreground), 0.1)',
    boxShadow: 'var(--shadow-lg)',
    padding: '10px 15px'
};

const defaultForm = {
    title: '',
    widgetType: 'stat_card',
    colSpan: 1,
    moduleId: '',
    aggregateType: 'count',
    aggregateField: '',
    groupByField: '',
    lineGroupBy: 'day',
    timePeriod: 'all',
    limit: 5,
};

function parseConfig(widget) {
    try {
        const c = JSON.parse(widget.configuration || '{}');
        return {
            title: widget.title,
            widgetType: widget.widgetType,
            colSpan: widget.colSpan,
            moduleId: c.moduleId ? String(c.moduleId) : '',
            aggregateType: c.aggregateType || 'count',
            aggregateField: c.aggregateField || '',
            groupByField: c.groupByField || '',
            lineGroupBy: c.lineGroupBy || 'day',
            timePeriod: c.timePeriod || 'all',
            limit: c.limit || 5,
        };
    } catch {
        return { ...defaultForm, title: widget.title, widgetType: widget.widgetType, colSpan: widget.colSpan };
    }
}

function buildConfig(form) {
    const cfg = {
        moduleId: form.moduleId ? parseInt(form.moduleId) : null,
        aggregateType: form.aggregateType,
        timePeriod: form.timePeriod,
    };
    if (form.aggregateField) cfg.aggregateField = form.aggregateField;
    if (form.groupByField) cfg.groupByField = form.groupByField;
    if (form.lineGroupBy) cfg.lineGroupBy = form.lineGroupBy;
    if (form.limit) cfg.limit = parseInt(form.limit);
    return JSON.stringify(cfg);
}

// ─── Widget Skeleton ───────────────────────────────────────────────────────
function WidgetSkeleton() {
    return (
        <div className="glass-card h-100 d-flex flex-column position-relative overflow-hidden" style={{ borderRadius: '24px', minHeight: '160px' }}>
            <div className="px-4 pt-4 pb-2">
                <div className="skeleton-line" style={{ width: '40%', height: '12px', borderRadius: '6px', background: 'hsla(var(--foreground),0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
            <div className="flex-grow-1 px-4 pb-4 d-flex flex-column gap-2 justify-content-center">
                <div className="skeleton-line" style={{ width: '60%', height: '36px', borderRadius: '8px', background: 'hsla(var(--foreground),0.08)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div className="skeleton-line" style={{ width: '80%', height: '12px', borderRadius: '6px', background: 'hsla(var(--foreground),0.06)', animation: 'pulse 1.5s ease-in-out infinite 0.2s' }} />
            </div>
        </div>
    );
}

// ─── Widget Wrapper ────────────────────────────────────────────────────────
function WidgetWrapper({ title, widgetType = 'stat_card', children, onEdit, onDelete, loading, delay = 0, accentIdx = 0 }) {
    const { t } = useTranslation();
    const accent = WIDGET_ACCENT[accentIdx % WIDGET_ACCENT.length];
    const iconName = WIDGET_ICON_MAP[widgetType] || 'barChart';
    return (
        <div
            className="widget-premium-card h-100 d-flex flex-column position-relative overflow-hidden"
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Left accent strip */}
            <div className="widget-accent-strip" style={{ background: accent.grad }} />

            {/* Glowing orb background */}
            <div className="widget-glow-orb" style={{ background: accent.glow }} />

            {/* Header */}
            <div className="widget-header d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-3">
                    <div className="widget-type-icon" style={{ background: accent.light, color: accent.solid }}>
                        <Icon name={iconName} size={15} />
                    </div>
                    <span className="widget-title">{title}</span>
                </div>
                <div className="widget-actions d-flex gap-1">
                    <button className="btn-action-mini" onClick={onEdit} title={t('edit')}>
                        <Icon name="edit" size={13} />
                    </button>
                    <button className="btn-action-mini btn-action-delete" onClick={onDelete} title={t('delete')}>
                        <Icon name="delete" size={13} />
                    </button>
                </div>
            </div>

            <div className="widget-body flex-grow-1">
                {loading ? <WidgetSkeleton /> : children}
            </div>
        </div>
    );
}

// ─── Individual widget renderers ────────────────────────────────────────────
function StatCardWidget({ widget, data }) {
    const accentIdx = (widget.id || 0) % WIDGET_ACCENT.length;
    const accent = WIDGET_ACCENT[accentIdx];

    const val = data?.statValue !== null && data?.statValue !== undefined
        ? Number(data.statValue).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
        : '—';

    return (
        <div className="stat-card-inner d-flex align-items-center gap-4 h-100">
            {/* Big colored number */}
            <div className="stat-card-value-col">
                <div
                    className="stat-value"
                    style={{
                        background: accent.grad,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}
                >
                    {val}
                </div>
                {data?.moduleName && (
                    <span
                        className="stat-module-badge"
                        style={{ background: accent.light, color: accent.solid, border: `1px solid ${accent.glow}` }}
                    >
                        {data.moduleName}
                    </span>
                )}
            </div>
        </div>
    );
}

function BarChartWidget({ widget, data }) {
    const { t } = useTranslation();
    if (!data?.chartData?.length) {
        return (
            <div className="h-100 d-flex align-items-center justify-content-center text-muted small opacity-60">
                <div className="text-center">
                    <Icon name="barChart" size={32} className="mb-2 opacity-20" />
                    <p>{t('no_data')}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="h-100" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsla(var(--foreground), 0.05)" />
                    <XAxis 
                        dataKey="label" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsla(var(--foreground), 0.5)' }} 
                    />
                    <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsla(var(--foreground), 0.5)' }} 
                    />
                    <Tooltip 
                        contentStyle={TOOLTIP_STYLE} 
                        cursor={{ fill: 'hsla(var(--primary), 0.05)' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {data.chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function PieChartWidget({ widget, data }) {
    const { t } = useTranslation();
    if (!data?.chartData?.length) {
        return (
            <div className="h-100 d-flex align-items-center justify-content-center text-muted small opacity-60">
                <div className="text-center">
                    <Icon name="barChart" size={32} className="mb-2 opacity-20" />
                    <p>{t('no_data')}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="h-100" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data.chartData}
                        cx="50%" cy="50%"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="label"
                        labelLine={false}
                    >
                        {data.chartData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} cornerRadius={4} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend 
                        iconType="circle" 
                        iconSize={8} 
                        wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} 
                        formatter={(value) => <span className="opacity-70">{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

function LineChartWidget({ widget, data }) {
    const { t } = useTranslation();
    if (!data?.chartData?.length) {
        return (
            <div className="h-100 d-flex align-items-center justify-content-center text-muted small opacity-60">
                <div className="text-center">
                    <Icon name="barChart" size={32} className="mb-2 opacity-20" />
                    <p>{t('no_data')}</p>
                </div>
            </div>
        );
    }
    return (
        <div className="h-100" style={{ minHeight: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsla(var(--foreground), 0.05)" />
                    <XAxis 
                        dataKey="label" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsla(var(--foreground), 0.5)' }} 
                    />
                    <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: 'hsla(var(--foreground), 0.5)' }} 
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }} 
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

function RecentRecordsWidget({ widget, data }) {
    const { t } = useTranslation();
    const rows = data?.rows || [];
    const columns = data?.columns || [];
    const columnMeta = data?.columnMeta || [];
    const scrollRef = useRef(null);
    const [scrollState, setScrollState] = useState({ thumbTop: 0, thumbHeight: 0, visible: false });
    const hideTimer = useRef(null);
    const MAX_VISIBLE = 5;
    const hasMore = rows.length > MAX_VISIBLE;
    const accentIdx = (widget.id || 0) % WIDGET_ACCENT.length;
    const accent = WIDGET_ACCENT[accentIdx];

    const updateThumb = (el) => {
        if (!el || el.scrollHeight <= el.clientHeight) {
            setScrollState(s => ({ ...s, thumbHeight: 0, visible: false }));
            return;
        }
        const ratio = el.clientHeight / el.scrollHeight;
        const thumbH = Math.max(ratio * el.clientHeight, 28);
        const maxScroll = el.scrollHeight - el.clientHeight;
        const thumbTop = (el.scrollTop / maxScroll) * (el.clientHeight - thumbH);
        setScrollState({ thumbTop, thumbHeight: thumbH, visible: true });

        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            setScrollState(s => ({ ...s, visible: false }));
        }, 1200);
    };

    const handleScroll = (e) => updateThumb(e.currentTarget);
    const handleMouseEnter = () => updateThumb(scrollRef.current);
    const handleMouseLeave = () => {
        clearTimeout(hideTimer.current);
        setScrollState(s => ({ ...s, visible: false }));
    };

    const atBottom = scrollState.thumbHeight > 0
        ? scrollState.thumbTop + scrollState.thumbHeight >= (scrollRef.current?.clientHeight ?? 0) - 4
        : false;

    if (rows.length === 0) {
        return (
            <div className="h-100 d-flex align-items-center justify-content-center text-muted small opacity-60">
                <div className="text-center">
                    <Icon name="records" size={32} className="mb-2 opacity-20" />
                    <p>{t('no_data')}</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="records-scroll-wrapper position-relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Bottom fade hint */}
            {hasMore && !atBottom && (
                <div className="records-fade-mask" />
            )}

            {/* Custom scroll track + thumb */}
            <div className="records-scrollbar-track">
                <div
                    className="records-scrollbar-thumb"
                    style={{
                        top: scrollState.thumbTop,
                        height: scrollState.thumbHeight,
                        background: accent.grad,
                        opacity: scrollState.visible ? 1 : 0,
                    }}
                />
            </div>

            <div
                ref={scrollRef}
                className="records-table-scroll"
                onScroll={handleScroll}
            >
                <table className="table table-premium-mini mb-0">
                    <thead className="records-sticky-head">
                        <tr>
                            {columns.map(col => {
                                const meta = columnMeta.find(m => m.name === col);
                                return <th key={col}>{meta?.label || col}</th>;
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i} className="records-row">
                                {columns.map(col => {
                                    const displayVal = row[`__display_${col}`];
                                    const linkData = row[`__links_${col}`];

                                    return (
                                        <td key={col} className="small text-truncate" style={{ maxWidth: '150px' }}>
                                            {linkData && linkData.length > 0 ? (
                                                <div className="d-flex flex-wrap gap-1">
                                                    {linkData.map((link, idx) => (
                                                        <Link
                                                            key={idx}
                                                            to={`/modules/${link.moduleId}/records/${link.recordId}`}
                                                            className="badge bg-surface bg-opacity-50 text-primary border border-theme-accent text-decoration-none"
                                                        >
                                                            <Icon name="link" size={12} className="me-1" /> {link.display}
                                                        </Link>
                                                    ))}
                                                </div>
                                            ) : displayVal ? (
                                                displayVal
                                            ) : Array.isArray(row[col]) ? (
                                                row[col].join(', ')
                                            ) : (
                                                String(row[col] ?? '—')
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Row count badge */}
            {hasMore && (
                <div className="records-count-badge">
                    {rows.length} {t('records_count_label')}
                </div>
            )}
        </div>
    );
}

function WidgetRenderer({ widget, data, onEdit, onDelete, loading, index }) {
    const accentIdx = (widget.id || 0) % WIDGET_ACCENT.length;
    const content = (() => {
        switch (widget.widgetType) {
            case 'stat_card': return <StatCardWidget widget={widget} data={data} />;
            case 'bar_chart': return <BarChartWidget widget={widget} data={data} />;
            case 'pie_chart': return <PieChartWidget widget={widget} data={data} />;
            case 'line_chart': return <LineChartWidget widget={widget} data={data} />;
            case 'recent_records': return <RecentRecordsWidget widget={widget} data={data} />;
            default: return null;
        }
    })();

    return (
        <WidgetWrapper
            title={widget.title}
            widgetType={widget.widgetType}
            accentIdx={accentIdx}
            onEdit={onEdit}
            onDelete={onDelete}
            loading={loading}
            delay={index * 60}
        >
            {content}
        </WidgetWrapper>
    );
}

// ─── Widget config modal ────────────────────────────────────────────────────
function WidgetModal({ show, editing, onClose, onSave, modules, WIDGET_TYPES, TIME_PERIODS, AGG_TYPES }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(defaultForm);
    const [fields, setFields] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (show) {
            setForm(editing ? parseConfig(editing) : { ...defaultForm });
        }
    }, [show, editing]);

    useEffect(() => {
        if (form.moduleId) {
            getFields(form.moduleId)
                .then(setFields)
                .catch(() => setFields([]));
        } else {
            setFields([]);
        }
    }, [form.moduleId]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const handleSave = async () => {
        if (!form.title.trim() || !form.moduleId) return;
        setSaving(true);
        try {
            await onSave({
                title: form.title,
                widgetType: form.widgetType,
                colSpan: form.colSpan,
                configuration: buildConfig(form),
            });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const numberFields = fields.filter(f =>
        ['number', 'currency', 'percentage', 'formula'].includes(f.type)
    );

    if (!show) return null;

    return createPortal(
        <div className="modal show d-block glass-modal" tabIndex="-1" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                <div className="modal-content border-0 shadow-xl overflow-hidden">
                    <div className="modal-header modal-header-premium border-0">
                        <h5 className="modal-title text-gradient fw-800 fs-4 d-flex align-items-center gap-2">
                            <Icon name={editing ? "edit" : "plus"} size={24} />
                            {editing ? t('edit_widget') : t('add_new_widget')}
                        </h5>
                        <button type="button" className="btn-close btn-close-premium" onClick={onClose} disabled={saving}></button>
                    </div>
                    <div className="modal-body modal-body-premium">
                        <div className="row g-4">
                            {/* Title */}
                            <div className="col-12">
                                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('title')}</label>
                                <input
                                    className="form-control form-control-lg border-2"
                                    value={form.title}
                                    onChange={e => set('title', e.target.value)}
                                    placeholder={t('title_placeholder') || '...'}
                                />
                            </div>

                            {/* Widget Type */}
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('widget_type')}</label>
                                <select className="form-select form-select-lg border-2" value={form.widgetType} onChange={e => set('widgetType', e.target.value)}>
                                    {WIDGET_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ColSpan */}
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('width')}</label>
                                <select className="form-select form-select-lg border-2" value={form.colSpan} onChange={e => set('colSpan', parseInt(e.target.value))}>
                                    <option value={1}>{t('small_width')}</option>
                                    <option value={2}>{t('medium_width')}</option>
                                    <option value={3}>{t('full_width')}</option>
                                </select>
                            </div>

                            {/* Module */}
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('module')}</label>
                                <select className="form-select form-select-lg border-2" value={form.moduleId} onChange={e => set('moduleId', e.target.value)}>
                                    <option value="">{t('select_module_placeholder')}</option>
                                    {modules.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Time Period */}
                            <div className="col-md-6">
                                <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('time_range')}</label>
                                <select className="form-select form-select-lg border-2" value={form.timePeriod} onChange={e => set('timePeriod', e.target.value)}>
                                    {TIME_PERIODS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Configuration divider */}
                            <div className="col-12 mt-4 mb-1">
                                <h6 className="text-primary fw-bold small text-uppercase tracking-widest">{t('configuration')}</h6>
                                <hr className="mt-2 mb-0 opacity-10" />
                            </div>

                            {/* stat_card config */}
                            {form.widgetType === 'stat_card' && (
                                <>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('calculation')}</label>
                                        <select className="form-select border-2" value={form.aggregateType} onChange={e => set('aggregateType', e.target.value)}>
                                            {AGG_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                    </div>
                                    {form.aggregateType !== 'count' && (
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('value_field')}</label>
                                            <select className="form-select border-2" value={form.aggregateField} onChange={e => set('aggregateField', e.target.value)}>
                                                <option value="">{t('select_field_placeholder')}</option>
                                                {numberFields.map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* bar_chart / pie_chart config */}
                            {(form.widgetType === 'bar_chart' || form.widgetType === 'pie_chart') && (
                                <>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('group_by_field')}</label>
                                        <select className="form-select border-2" value={form.groupByField} onChange={e => set('groupByField', e.target.value)}>
                                            <option value="">{t('select_field_placeholder')}</option>
                                            {fields.map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('value_calculation')}</label>
                                        <select className="form-select border-2" value={form.aggregateType} onChange={e => set('aggregateType', e.target.value)}>
                                            {AGG_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                    </div>
                                    {form.aggregateType !== 'count' && (
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('value_field')}</label>
                                            <select className="form-select border-2" value={form.aggregateField} onChange={e => set('aggregateField', e.target.value)}>
                                                <option value="">{t('select_field_placeholder')}</option>
                                                {numberFields.map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* line_chart config */}
                            {form.widgetType === 'line_chart' && (
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('grouping')}</label>
                                    <select className="form-select border-2" value={form.lineGroupBy} onChange={e => set('lineGroupBy', e.target.value)}>
                                        <option value="day">{t('daily')}</option>
                                        <option value="week">{t('weekly')}</option>
                                        <option value="month">{t('monthly')}</option>
                                    </select>
                                </div>
                            )}

                            {/* recent_records config */}
                            {form.widgetType === 'recent_records' && (
                                <div className="col-md-6">
                                    <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2">{t('record_count_to_show')}</label>
                                    <input
                                        type="number"
                                        className="form-control border-2"
                                        value={form.limit}
                                        min={1} max={20}
                                        onChange={e => set('limit', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer modal-footer-premium border-0">
                        <button className="btn btn-blur px-4" onClick={onClose} disabled={saving}>{t('cancel')}</button>
                        <button
                            className="btn btn-primary px-5 shadow-premium hover-lift"
                            onClick={handleSave}
                            disabled={saving || !form.title.trim() || !form.moduleId}
                        >
                            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : <Icon name="check" size={18} className="me-2" />}
                            {editing ? t('update') : t('add')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Main page ──────────────────────────────────────────────────────────────
function DashboardPage() {
    const { t } = useTranslation();
    const { selectedTenantId } = useTenant();

    const WIDGET_TYPES = [
        { value: 'stat_card', label: t('stat_card'), icon: 'barChart' },
        { value: 'bar_chart', label: t('bar_chart_widget'), icon: 'barChart' },
        { value: 'pie_chart', label: t('pie_chart_widget'), icon: 'barChart' },
        { value: 'line_chart', label: t('line_chart_time'), icon: 'barChart' },
        { value: 'recent_records', label: t('recent_records_widget'), icon: 'records' },
    ];

    const TIME_PERIODS = [
        { value: 'all', label: t('all_time') },
        { value: '7d', label: t('last_7_days') },
        { value: '30d', label: t('last_30_days') },
        { value: '90d', label: t('last_90_days') },
        { value: '365d', label: t('last_1_year') },
    ];

    const AGG_TYPES = [
        { value: 'count', label: t('count') },
        { value: 'sum', label: t('sum') },
        { value: 'avg', label: t('average') },
        { value: 'min', label: t('minimum') },
        { value: 'max', label: t('maximum') },
    ];

    const [widgets, setWidgets] = useState([]);
    const [widgetData, setWidgetData] = useState({});
    const [loadingWidgets, setLoadingWidgets] = useState(true);
    const [loadingData, setLoadingData] = useState({});
    const [modules, setModules] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingWidget, setEditingWidget] = useState(null);
    const [deleteWidgetId, setDeleteWidgetId] = useState(null);

    const loadWidgets = useCallback(async () => {
        try {
            setLoadingWidgets(true);
            const data = await getDashboardWidgets();
            setWidgets(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
            setWidgets([]);
        } finally {
            setLoadingWidgets(false);
        }
    }, [selectedTenantId]);

    useEffect(() => {
        loadWidgets();
        getModules()
            .then(data => setModules(Array.isArray(data) ? data : []))
            .catch(() => setModules([]));
    }, [loadWidgets]);

    // Load each widget's data after widgets are loaded
    useEffect(() => {
        if (!Array.isArray(widgets)) return;
        widgets.forEach(w => {
            setLoadingData(prev => ({ ...prev, [w.id]: true }));
            getDashboardWidgetData(w.id)
                .then(data => setWidgetData(prev => ({ ...prev, [w.id]: data })))
                .catch(() => setWidgetData(prev => ({ ...prev, [w.id]: null })))
                .finally(() => setLoadingData(prev => ({ ...prev, [w.id]: false })));
        });
    }, [widgets]);

    const handleSave = async (dto) => {
        if (editingWidget) {
            await updateDashboardWidget(editingWidget.id, dto);
        } else {
            await createDashboardWidget({ ...dto, sortOrder: widgets.length });
        }
        setEditingWidget(null);
        await loadWidgets();
    };

    const handleDelete = async () => {
        if (!deleteWidgetId) return;
        const id = deleteWidgetId;
        await deleteDashboardWidget(id);
        setWidgets(prev => prev.filter(w => w.id !== id));
        setWidgetData(prev => { const n = { ...prev }; delete n[id]; return n; });
        setDeleteWidgetId(null);
    };

    const openAdd = () => { setEditingWidget(null); setShowModal(true); };
    const openEdit = (w) => { setEditingWidget(w); setShowModal(true); };

    const colClass = (span) => {
        if (span === 3) return 'col-12';
        if (span === 2) return 'col-12 col-md-8';
        return 'col-12 col-md-6 col-lg-4';
    };

    return (
        <div className="container-fluid py-4 fade-in">
            {/* Header */}
            <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                    <h2 className="mb-0 fw-bold">{t('dashboard')}</h2>
                    <p className="text-muted mb-0 small">{t('personalized_widgets_desc')}</p>
                </div>
                <button className="btn btn-primary rounded-pill px-4 hover-lift" onClick={openAdd}>
                    <Icon name="plus" size={16} className="me-2" />
                    {t('add_widget_button')}
                </button>
            </div>

            {/* Empty state */}
            {!loadingWidgets && widgets.length === 0 && (
                <div className="glass-card p-5 text-center rounded-4">
                    <div className="mb-3 opacity-40">
                        <Icon name="barChart" size={48} />
                    </div>
                    <h5 className="fw-bold mb-2">{t('no_widgets_yet')}</h5>
                    <p className="text-muted mb-4">
                        {t('first_widget_hint')}
                    </p>
                    <button className="btn btn-primary rounded-pill px-4" onClick={openAdd}>
                        <Icon name="plus" size={16} className="me-2" />
                        {t('add_first_widget')}
                    </button>
                </div>
            )}

            {/* Widget grid */}
            {loadingWidgets ? (
                <div className="row g-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="col-12 col-md-6 col-lg-4">
                            <WidgetSkeleton />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="row g-4 align-items-stretch stagger-in">
                    {(Array.isArray(widgets) ? widgets : []).map((widget, idx) => (
                        <div key={widget.id} className={colClass(widget.colSpan)}>
                            <WidgetRenderer 
                                widget={widget} 
                                data={widgetData[widget.id]} 
                                loading={loadingData[widget.id]}
                                index={idx}
                                onEdit={() => openEdit(widget)}
                                onDelete={() => setDeleteWidgetId(widget.id)}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <WidgetModal
                show={showModal}
                editing={editingWidget}
                modules={modules}
                onClose={() => { setShowModal(false); setEditingWidget(null); }}
                onSave={handleSave}
                WIDGET_TYPES={WIDGET_TYPES}
                TIME_PERIODS={TIME_PERIODS}
                AGG_TYPES={AGG_TYPES}
            />

            <ConfirmModal
                show={!!deleteWidgetId}
                onClose={() => setDeleteWidgetId(null)}
                onConfirm={handleDelete}
                title={t('delete_widget')}
                message={t('confirm_delete_widget')}
                confirmText={t('delete')}
                type="danger"
            />

            <style>{`
                /* ── Widget Card Shell ── */
                .widget-premium-card {
                    border-radius: 20px;
                    background: hsla(var(--background), 0.65);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border: 1px solid hsla(var(--foreground), 0.07);
                    box-shadow: 0 4px 24px -8px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06);
                    transition: transform 0.35s cubic-bezier(0.16,1,0.3,1),
                                box-shadow 0.35s cubic-bezier(0.16,1,0.3,1),
                                border-color 0.35s ease;
                    cursor: default;
                }
                .widget-premium-card:hover {
                    transform: translateY(-6px) scale(1.008);
                    box-shadow: 0 24px 60px -12px rgba(0,0,0,0.18), 0 8px 20px -8px rgba(0,0,0,0.1);
                    border-color: hsla(var(--foreground), 0.14);
                }
                [data-mode="dark"] .widget-premium-card {
                    background: hsla(var(--background), 0.75);
                    border-color: hsla(var(--foreground), 0.1);
                    box-shadow: 0 4px 24px -8px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2);
                }
                [data-mode="dark"] .widget-premium-card:hover {
                    box-shadow: 0 24px 60px -12px rgba(0,0,0,0.5), 0 8px 20px -8px rgba(0,0,0,0.3);
                }

                /* ── Left Accent Strip ── */
                .widget-accent-strip {
                    position: absolute;
                    left: 0; top: 16px; bottom: 16px;
                    width: 4px;
                    border-radius: 0 4px 4px 0;
                    opacity: 0.85;
                    transition: opacity 0.3s ease, top 0.3s ease, bottom 0.3s ease;
                    pointer-events: none;
                    z-index: 2;
                }
                .widget-premium-card:hover .widget-accent-strip {
                    opacity: 1;
                    top: 8px;
                    bottom: 8px;
                }

                /* ── Glow Orb ── */
                .widget-glow-orb {
                    position: absolute;
                    top: -40px; right: -40px;
                    width: 130px; height: 130px;
                    border-radius: 50%;
                    filter: blur(40px);
                    opacity: 0.35;
                    pointer-events: none;
                    z-index: 0;
                    transition: opacity 0.4s ease, transform 0.4s ease;
                }
                .widget-premium-card:hover .widget-glow-orb {
                    opacity: 0.6;
                    transform: scale(1.2);
                }

                /* ── Header ── */
                .widget-header {
                    padding: 18px 20px 12px 20px;
                    position: relative;
                    z-index: 1;
                }
                .widget-type-icon {
                    width: 34px; height: 34px;
                    border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
                }
                .widget-premium-card:hover .widget-type-icon {
                    transform: scale(1.12) rotate(-4deg);
                }
                .widget-title {
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.07em;
                    color: hsla(var(--foreground), 0.55);
                    line-height: 1;
                }

                /* ── Body ── */
                .widget-body {
                    padding: 4px 20px 20px 20px;
                    position: relative;
                    z-index: 1;
                }

                /* ── Recent Records scroll container ── */
                .records-scroll-wrapper {
                    position: relative;
                }
                .records-table-scroll {
                    overflow-y: auto;
                    max-height: 260px;
                    border-radius: 10px;
                    border: 1px solid hsla(var(--foreground), 0.06);
                    /* Hide native scrollbar */
                    scrollbar-width: none;
                }
                .records-table-scroll::-webkit-scrollbar {
                    display: none;
                }
                /* Sticky thead */
                .records-sticky-head th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background: hsla(var(--background), 0.96) !important;
                    backdrop-filter: blur(8px);
                    border-bottom: 1px solid hsla(var(--foreground), 0.08) !important;
                }
                /* Custom scrollbar track + thumb */
                .records-scrollbar-track {
                    position: absolute;
                    right: 4px;
                    top: 6px;
                    bottom: 6px;
                    width: 4px;
                    background: hsla(var(--foreground), 0.05);
                    border-radius: 99px;
                    z-index: 10;
                    pointer-events: none;
                    overflow: hidden;
                }
                .records-scrollbar-thumb {
                    position: absolute;
                    left: 0;
                    right: 0;
                    border-radius: 99px;
                    transition: opacity 0.35s ease, height 0.1s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
                }
                /* Row hover */
                .records-row {
                    transition: background 0.15s ease;
                }
                .records-row:hover {
                    background: hsla(var(--foreground), 0.035) !important;
                }
                /* Bottom fade mask */
                .records-fade-mask {
                    position: absolute;
                    bottom: 28px;
                    left: 0; right: 0;
                    height: 40px;
                    background: linear-gradient(to bottom, transparent, hsla(var(--background), 0.85));
                    pointer-events: none;
                    z-index: 3;
                    border-radius: 0 0 10px 10px;
                    transition: opacity 0.25s ease;
                }
                /* Row count pill */
                .records-count-badge {
                    display: flex;
                    justify-content: flex-end;
                    margin-top: 6px;
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                    color: hsla(var(--foreground), 0.38);
                }

                /* ── Stat Card ── */
                .stat-card-inner {
                    padding-top: 4px;
                }
                .stat-value {
                    font-size: 2.8rem;
                    font-weight: 900;
                    line-height: 1;
                    letter-spacing: -0.04em;
                    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
                    display: block;
                    margin-bottom: 8px;
                }
                .widget-premium-card:hover .stat-value {
                    transform: scale(1.04) translateX(2px);
                }
                .stat-module-badge {
                    display: inline-flex;
                    align-items: center;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 0.62rem;
                    font-weight: 700;
                    letter-spacing: 0.04em;
                    text-transform: uppercase;
                }

                /* ── Action Buttons ── */
                .btn-action-mini {
                    width: 30px; height: 30px;
                    border-radius: 9px;
                    border: 1px solid hsla(var(--foreground), 0.1);
                    background: hsla(var(--background), 0.6);
                    display: flex; align-items: center; justify-content: center;
                    color: hsla(var(--foreground), 0.5);
                    transition: all 0.2s ease;
                    padding: 0; cursor: pointer;
                }
                .btn-action-mini:hover {
                    background: hsl(var(--primary));
                    color: white;
                    border-color: hsl(var(--primary));
                    transform: scale(1.12);
                    box-shadow: 0 4px 12px hsla(var(--primary), 0.35);
                }
                .btn-action-mini.btn-action-delete:hover {
                    background: #ef4444;
                    border-color: #ef4444;
                    box-shadow: 0 4px 12px rgba(239,68,68,0.4);
                }
                .widget-actions {
                    opacity: 0;
                    transform: translateX(8px);
                    transition: opacity 0.25s ease, transform 0.25s ease;
                }
                .widget-premium-card:hover .widget-actions {
                    opacity: 1;
                    transform: translateX(0);
                }

                /* ── Table ── */
                .table-premium-mini th {
                    font-size: 0.63rem !important;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: hsla(var(--foreground), 0.45);
                    border: none;
                    padding: 6px 10px;
                    background: hsla(var(--foreground), 0.02);
                }
                .table-premium-mini td {
                    padding: 9px 10px;
                    border-bottom: 1px solid hsla(var(--foreground), 0.04);
                    color: hsla(var(--foreground), 0.8);
                }
                .table-premium-mini tr:last-child td { border-bottom: none; }
                .table-premium-mini tbody tr {
                    transition: background 0.15s ease;
                }
                .table-premium-mini tbody tr:hover {
                    background: hsla(var(--foreground), 0.03);
                }

                /* ── Scrollbar ── */
                .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: hsla(var(--foreground), 0.1);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}

export default DashboardPage;
