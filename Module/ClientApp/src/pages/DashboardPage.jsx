import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getDashboardWidgets, createDashboardWidget, updateDashboardWidget,
    deleteDashboardWidget, getDashboardWidgetData, getModules, getFields
} from '../services/api';
import { useTenant } from '../components/TenantContext';
import Icon from '../components/Icon';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const COLORS = ['#0dcaf0', '#6610f2', '#6f42c1', '#d63384', '#fd7e14', '#ffc107', '#198754', '#20c997'];

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

// ─── Widget card skeleton ───────────────────────────────────────────────────
function WidgetSkeleton() {
    return (
        <div className="glass-card p-4 h-100" style={{ minHeight: '180px', borderRadius: '20px' }}>
            <div className="placeholder-glow">
                <span className="placeholder col-5 mb-3 rounded-3" style={{ height: '16px', display: 'block' }}></span>
                <span className="placeholder col-8 rounded-3" style={{ height: '48px', display: 'block' }}></span>
            </div>
        </div>
    );
}

// ─── Individual widget renderers ────────────────────────────────────────────
function StatCardWidget({ widget, data }) {
    const accentColors = ['#0dcaf0', '#6610f2', '#198754', '#fd7e14', '#d63384', '#ffc107'];
    const colorIdx = widget.id % accentColors.length;
    const accent = accentColors[colorIdx];

    return (
        <div className="glass-card p-4 h-100 position-relative overflow-hidden" style={{ borderRadius: '20px', minHeight: '140px' }}>
            <div
                className="position-absolute"
                style={{ top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: `${accent}22` }}
            />
            <div className="text-muted small mb-2" style={{ fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {widget.title}
            </div>
            <div className="fw-bold" style={{ fontSize: '2.5rem', color: accent, lineHeight: 1.1 }}>
                {data?.statValue !== null && data?.statValue !== undefined
                    ? Number(data.statValue).toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                    : '—'}
            </div>
            {data?.moduleName && (
                <div className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                    {data.moduleName}
                </div>
            )}
        </div>
    );
}

function BarChartWidget({ widget, data }) {
    if (!data?.chartData?.length) {
        return (
            <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
                <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">{t('no_data')}</div>
            </div>
        );
    }
    return (
        <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
            <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
            <div style={{ flex: 1, minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsla(var(--foreground), 0.4)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsla(var(--foreground), 0.4)" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="value" fill="#0dcaf0" radius={[4, 4, 0, 0]}>
                            {data.chartData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function PieChartWidget({ widget, data }) {
    if (!data?.chartData?.length) {
        return (
            <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
                <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">{t('no_data')}</div>
            </div>
        );
    }
    return (
        <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
            <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
            <div style={{ flex: 1, minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data.chartData}
                            cx="50%" cy="50%"
                            innerRadius="40%"
                            outerRadius="70%"
                            dataKey="value"
                            nameKey="label"
                            labelLine={false}
                            label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                        >
                            {data.chartData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function LineChartWidget({ widget, data }) {
    if (!data?.chartData?.length) {
        return (
            <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
                <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted small">{t('no_data')}</div>
            </div>
        );
    }
    return (
        <div className="glass-card p-4 h-100 d-flex flex-column" style={{ borderRadius: '20px', minHeight: '280px' }}>
            <div className="text-muted small fw-semibold mb-3">{widget.title}</div>
            <div style={{ flex: 1, minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsla(var(--foreground), 0.4)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="hsla(var(--foreground), 0.4)" />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="value" stroke="#0dcaf0" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function RecentRecordsWidget({ widget, data }) {
    const rows = data?.rows || [];
    const columns = data?.columns || [];

    return (
        <div className="glass-card h-100 d-flex flex-column" style={{ borderRadius: '20px', overflow: 'hidden', minHeight: '220px' }}>
            <div className="px-4 pt-4 pb-2 text-muted small fw-semibold">{widget.title}</div>
            {rows.length === 0 ? (
                <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted small pb-4">{t('no_data')}</div>
            ) : (
                <div className="overflow-auto flex-grow-1">
                    <table className="table table-hover mb-0" style={{ fontSize: '0.82rem' }}>
                        <thead>
                            <tr>
                                {columns.map(col => <th key={col} className="px-4 py-2 border-0 text-muted fw-semibold">{col}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {columns.map(col => (
                                        <td key={col} className="px-4 py-2 border-0">
                                            {String(row[col] ?? '—').slice(0, 40)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function WidgetRenderer({ widget, data }) {
    switch (widget.widgetType) {
        case 'stat_card': return <StatCardWidget widget={widget} data={data} />;
        case 'bar_chart': return <BarChartWidget widget={widget} data={data} />;
        case 'pie_chart': return <PieChartWidget widget={widget} data={data} />;
        case 'line_chart': return <LineChartWidget widget={widget} data={data} />;
        case 'recent_records': return <RecentRecordsWidget widget={widget} data={data} />;
        default: return null;
    }
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

    return (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 2000 }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-dialog modal-lg modal-dialog-centered" onClick={e => e.stopPropagation()}>
                <div className="modal-content glass border-0 rounded-4 shadow-premium">
                    <div className="modal-header border-0 px-4 pt-4 pb-0">
                        <h5 className="modal-title fw-bold">{editing ? t('edit_widget') : t('add_new_widget')}</h5>
                        <button className="btn-close" onClick={onClose} />
                    </div>
                    <div className="modal-body px-4 py-3">
                        <div className="row g-3">
                            {/* Title */}
                            <div className="col-12">
                                <label className="form-label small fw-semibold">{t('title')}</label>
                                <input
                                    className="form-control rounded-3"
                                    value={form.title}
                                    onChange={e => set('title', e.target.value)}
                                    placeholder={t('title_placeholder') || '...'}
                                />
                            </div>

                            {/* Widget Type */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold">{t('widget_type')}</label>
                                <select className="form-select rounded-3" value={form.widgetType} onChange={e => set('widgetType', e.target.value)}>
                                    {WIDGET_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ColSpan */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold">{t('width')}</label>
                                <select className="form-select rounded-3" value={form.colSpan} onChange={e => set('colSpan', parseInt(e.target.value))}>
                                    <option value={1}>{t('small_width')}</option>
                                    <option value={2}>{t('medium_width')}</option>
                                    <option value={3}>{t('full_width')}</option>
                                </select>
                            </div>

                            {/* Module */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold">{t('module')}</label>
                                <select className="form-select rounded-3" value={form.moduleId} onChange={e => set('moduleId', e.target.value)}>
                                    <option value="">{t('select_module_placeholder')}</option>
                                    {modules.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Time Period */}
                            <div className="col-md-6">
                                <label className="form-label small fw-semibold">{t('time_range')}</label>
                                <select className="form-select rounded-3" value={form.timePeriod} onChange={e => set('timePeriod', e.target.value)}>
                                    {TIME_PERIODS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* stat_card config */}
                            {form.widgetType === 'stat_card' && (
                                <>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-semibold">{t('calculation')}</label>
                                        <select className="form-select rounded-3" value={form.aggregateType} onChange={e => set('aggregateType', e.target.value)}>
                                            {AGG_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                    </div>
                                    {form.aggregateType !== 'count' && (
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">{t('value_field')}</label>
                                            <select className="form-select rounded-3" value={form.aggregateField} onChange={e => set('aggregateField', e.target.value)}>
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
                                        <label className="form-label small fw-semibold">{t('group_by_field')}</label>
                                        <select className="form-select rounded-3" value={form.groupByField} onChange={e => set('groupByField', e.target.value)}>
                                            <option value="">{t('select_field_placeholder')}</option>
                                            {fields.map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-semibold">{t('value_calculation')}</label>
                                        <select className="form-select rounded-3" value={form.aggregateType} onChange={e => set('aggregateType', e.target.value)}>
                                            {AGG_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                    </div>
                                    {form.aggregateType !== 'count' && (
                                        <div className="col-md-6">
                                            <label className="form-label small fw-semibold">{t('value_field')}</label>
                                            <select className="form-select rounded-3" value={form.aggregateField} onChange={e => set('aggregateField', e.target.value)}>
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
                                    <label className="form-label small fw-semibold">{t('grouping')}</label>
                                    <select className="form-select rounded-3" value={form.lineGroupBy} onChange={e => set('lineGroupBy', e.target.value)}>
                                        <option value="day">{t('daily')}</option>
                                        <option value="week">{t('weekly')}</option>
                                        <option value="month">{t('monthly')}</option>
                                    </select>
                                </div>
                            )}

                            {/* recent_records config */}
                            {form.widgetType === 'recent_records' && (
                                <div className="col-md-6">
                                    <label className="form-label small fw-semibold">{t('record_count_to_show')}</label>
                                    <input
                                        type="number"
                                        className="form-control rounded-3"
                                        value={form.limit}
                                        min={1} max={20}
                                        onChange={e => set('limit', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
                        <button className="btn btn-blur rounded-pill px-4" onClick={onClose}>{t('cancel')}</button>
                        <button
                            className="btn btn-primary rounded-pill px-4"
                            onClick={handleSave}
                            disabled={saving || !form.title.trim() || !form.moduleId}
                        >
                            {saving ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                            {editing ? t('update') : t('add')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
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

    const handleDelete = async (id) => {
        if (!window.confirm(t('confirm_delete_widget'))) return;
        await deleteDashboardWidget(id);
        setWidgets(prev => prev.filter(w => w.id !== id));
        setWidgetData(prev => { const n = { ...prev }; delete n[id]; return n; });
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
                    <h2 className="mb-0 fw-bold">Dashboard</h2>
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
                <div className="row g-4 align-items-stretch">
                    {(Array.isArray(widgets) ? widgets : []).map(widget => (
                        <div key={widget.id} className={colClass(widget.colSpan)}>
                            <div className="position-relative h-100 widget-wrapper">
                                {/* Widget actions */}
                                <div
                                    className="position-absolute widget-actions d-flex gap-1"
                                    style={{ top: '10px', right: '10px', zIndex: 10, opacity: 0, transition: 'opacity 0.2s' }}
                                >
                                    <button
                                        className="btn btn-blur btn-sm rounded-circle p-1"
                                        style={{ width: '28px', height: '28px' }}
                                        onClick={() => openEdit(widget)}
                                        title={t('edit')}
                                    >
                                        <Icon name="edit" size={13} />
                                    </button>
                                    <button
                                        className="btn btn-blur btn-sm rounded-circle p-1"
                                        style={{ width: '28px', height: '28px' }}
                                        onClick={() => handleDelete(widget.id)}
                                        title={t('delete')}
                                    >
                                        <Icon name="delete" size={13} />
                                    </button>
                                </div>

                                {loadingData[widget.id] ? (
                                    <WidgetSkeleton />
                                ) : (
                                    <WidgetRenderer widget={widget} data={widgetData[widget.id]} />
                                )}
                            </div>
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

            <style>{`
                .widget-wrapper:hover .widget-actions {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
}

export default DashboardPage;
