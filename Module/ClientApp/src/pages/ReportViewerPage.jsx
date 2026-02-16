import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getReportData, getModule, getReport } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const ReportViewerPage = () => {
    const { t } = useTranslation();
    const { moduleId, reportId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [report, setReport] = useState(null);
    const [module, setModule] = useState(null);
    const [reportData, setReportData] = useState(null);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    useEffect(() => {
        fetchData();
    }, [moduleId, reportId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [moduleInfo, reportInfo, data] = await Promise.all([
                getModule(moduleId),
                getReport(moduleId, reportId),
                getReportData(moduleId, reportId)
            ]);
            setModule(moduleInfo);
            setReport(reportInfo);
            setReportData(data);
        } catch (err) {
            setError(err.message || 'Failed to load report data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-5 text-center">{t('loading')}</div>;
    if (error) return <div className="p-5 text-center text-danger">{error}</div>;

    const renderHeader = () => (
        <div className="d-flex align-items-center gap-3 mb-4">
            <button
                onClick={() => navigate(`/modules/${moduleId}/reports`)}
                className="btn btn-outline-secondary btn-sm"
            >
                ← {t('back')}
            </button>
            <div>
                <h2 className="mb-0">{report?.name}</h2>
                <p className="text-muted mb-0">{module?.name} / {report?.type}</p>
            </div>
        </div>
    );

    const renderList = () => {
        if (!reportData?.rows || reportData.rows.length === 0) {
            return <div className="alert alert-info">{t('no_data')}</div>;
        }

        const columns = reportData.columns || Object.keys(reportData.rows[0]);

        return (
            <div className="table-responsive glass rounded-4 p-3 border">
                <table className="table table-hover">
                    <thead>
                        <tr>
                            {columns.map(col => <th key={col}>{col}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.rows.map((row, idx) => (
                            <tr key={idx}>
                                {columns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderChart = () => {
        if (!reportData?.chartData || reportData.chartData.length === 0) {
            return <div className="alert alert-info">{t('no_data')}</div>;
        }

        return (
            <div className="glass rounded-4 p-4 border" style={{ height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="value" name={t('record_count')} fill="#0dcaf0" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    return (
        <div className="container-fluid py-4 fade-in">
            {renderHeader()}

            <div className="row">
                <div className="col-12">
                    {report?.type === 'List' ? renderList() : renderChart()}
                </div>
            </div>
        </div>
    );
};

export default ReportViewerPage;
