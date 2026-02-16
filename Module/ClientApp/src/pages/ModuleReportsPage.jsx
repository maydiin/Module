import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getReports, createReport, updateReport, deleteReport, getModule } from '../services/api';

const ModuleReportsPage = () => {
    const { t } = useTranslation();
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [module, setModule] = useState(null);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingReport, setEditingReport] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        type: 'List',
        configuration: '{}',
        isActive: true
    });

    const reportTypes = ['List', 'Chart', 'Pivot'];

    useEffect(() => {
        fetchData();
    }, [moduleId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [moduleData, reportsData] = await Promise.all([
                getModule(moduleId),
                getReports(moduleId)
            ]);
            setModule(moduleData);
            setReports(reportsData);
        } catch (err) {
            setError(t('failed_load_reports'));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (report) => {
        setEditingReport(report);
        setFormData({
            name: report.name,
            type: report.type,
            configuration: report.configuration,
            isActive: report.isActive
        });
        setShowModal(true);
    };

    const handleAddNew = () => {
        setEditingReport(null);
        setFormData({
            name: '',
            type: 'List',
            configuration: '{\n  "columns": [],\n  "filters": []\n}',
            isActive: true
        });
        setShowModal(true);
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm(t('confirm_delete_report'))) {
            try {
                await deleteReport(moduleId, id);
                fetchData();
            } catch (err) {
                alert(t('failed_delete_report'));
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingReport) {
                await updateReport(moduleId, editingReport.id, formData);
            } else {
                await createReport(moduleId, formData);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert(t('failed_save_report') + ': ' + (err.response?.data?.error || err.message));
        }
    };

    if (loading) return (
        <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">{t('loading')}</span>
            </div>
            <p className="mt-2 text-muted">{t('loading_reports')}</p>
        </div>
    );

    return (
        <div className="fade-in">
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-5 gap-3">
                <div className="d-flex align-items-center gap-3">
                    <button
                        onClick={() => navigate(`/modules/${moduleId}/records`)}
                        className="btn btn-light btn-icon border shadow-sm rounded-circle"
                        title={t('back_records')}
                        style={{ width: '40px', height: '40px' }}
                    >
                        ←
                    </button>
                    <div>
                        <h1 className="display-5 mb-1">{module?.name} {t('custom_reports')}</h1>
                        <p className="text-muted lead mb-0">{t('reports_subtitle_desc')}</p>
                    </div>
                </div>

                <button
                    onClick={handleAddNew}
                    className="btn btn-info text-white btn-lg px-4 shadow-sm"
                >
                    <span className="fs-5 me-2">+</span> {t('add_report')}
                </button>
            </div>

            {/* Content */}
            {reports.length === 0 ? (
                <div className="text-center py-5 glass rounded-4 border-dashed border-2">
                    <div className="fs-1 mb-3 opacity-50">📊</div>
                    <h3 className="h4">{t('no_reports_yet')}</h3>
                    <p className="text-muted">{t('no_reports_desc')}</p>
                    <button onClick={handleAddNew} className="btn btn-info text-white mt-3">
                        {t('create_first_report')}
                    </button>
                </div>
            ) : (
                <div className="row g-4">
                    {reports.map((report) => (
                        <div key={report.id} className="col-lg-4 col-md-6">
                            <div
                                className="card h-100 border-0 shadow-soft-hover"
                                onClick={() => navigate(`/modules/${moduleId}/reports/${report.id}/view`)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="card-body p-4 d-flex flex-column">
                                    <div className="d-flex align-items-center justify-content-between mb-3">
                                        <h5 className="card-title mb-0">{report.name}</h5>
                                        <div className="d-flex align-items-center gap-2">
                                            <span className={`badge ${report.isActive ? 'bg-success text-white' : 'bg-secondary text-white'}`}>
                                                {report.isActive ? t('active') : t('inactive')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <span className="badge bg-info bg-opacity-10 text-info px-2 py-1">
                                            {report.type}
                                        </span>
                                    </div>

                                    <div className="mt-auto d-flex justify-content-between align-items-center text-muted small">
                                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-sm btn-outline-danger"
                                                onClick={(e) => handleDelete(report.id, e)}
                                                title={t('delete')}
                                            >
                                                ✕
                                            </button>
                                            <button
                                                className="btn btn-light btn-sm rounded-circle shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEdit(report);
                                                }}
                                                style={{ width: '32px', height: '32px', lineHeight: '18px' }}
                                                title={t('edit')}
                                            >
                                                ✎
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content shadow-lg border-0">
                            <div className="modal-header border-bottom-0 pb-0">
                                <h5 className="modal-title fw-bold">
                                    {editingReport ? t('edit_report') : t('new_report')}
                                </h5>
                                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <form id="reportForm" onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-uppercase text-muted">{t('report_name')}</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="row g-3 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted">{t('report_type')}</label>
                                            <select
                                                value={formData.type}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                className="form-select"
                                            >
                                                {reportTypes.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase text-muted">{t('status')}</label>
                                            <div className="form-check form-switch pt-1">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id="isActiveSwitch"
                                                    checked={formData.isActive}
                                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                                />
                                                <label className="form-check-label" htmlFor="isActiveSwitch">
                                                    {formData.isActive ? t('active') : t('inactive')}
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label small fw-bold text-uppercase text-muted">{t('report_config')}</label>
                                        <textarea
                                            value={formData.configuration}
                                            onChange={(e) => setFormData({ ...formData, configuration: e.target.value })}
                                            className="form-control font-monospace small"
                                            style={{ height: '200px' }}
                                            spellCheck="false"
                                        />
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer border-top-0 pt-0 pb-4 px-4">
                                <button
                                    type="button"
                                    className="btn btn-light"
                                    onClick={() => setShowModal(false)}
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    form="reportForm"
                                    className="btn btn-info text-white px-4"
                                >
                                    {t('save_report')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ModuleReportsPage;
