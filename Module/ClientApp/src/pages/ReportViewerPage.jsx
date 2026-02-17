import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getReportData, getModule, getReport } from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line,
    FunnelChart, Funnel, ScatterChart, Scatter, ZAxis, LabelList
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

    const COLORS = ['#0dcaf0', '#6610f2', '#6f42c1', '#d63384', '#fd7e14', '#ffc107', '#198754', '#20c997'];

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

    const renderHeader = () => {
        const config = JSON.parse(report?.configuration || '{}');
        const chartType = config.chartType?.toLowerCase() || 'bar';
        const displayType = report?.type === 'Chart'
            ? t(`chart_${chartType}`)
            : t(`report_type_${report?.type?.toLowerCase()}`);

        return (
            <div className="d-flex align-items-center gap-3 mb-4">
                <button
                    onClick={() => navigate(`/modules/${moduleId}/reports`)}
                    className="btn btn-outline-secondary btn-sm"
                >
                    ← {t('back')}
                </button>
                <div>
                    <h2 className="mb-0">{report?.name}</h2>
                    <p className="text-muted mb-0">{module?.name} / {displayType}</p>
                </div>
            </div>
        );
    };

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

        const config = JSON.parse(report.configuration || '{}');
        const chartType = config.chartType?.toLowerCase() || 'bar';

        const chartContainer = (content) => (
            <div className="glass rounded-4 p-4 border overflow-hidden" style={{ height: '500px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    {content}
                </ResponsiveContainer>
            </div>
        );

        if (chartType === 'line') {
            return chartContainer(
                <LineChart data={reportData.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend />
                    <Line type="monotone" dataKey="value" name={t('value')} stroke="#0dcaf0" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
            );
        }

        if (chartType === 'pie') {
            return chartContainer(
                <PieChart>
                    <Pie
                        data={reportData.chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="label"
                    >
                        {reportData.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            );
        }

        if (chartType === 'funnel') {
            return chartContainer(
                <FunnelChart>
                    <Tooltip />
                    <Funnel
                        dataKey="value"
                        data={reportData.chartData}
                        isAnimationActive
                    >
                        <LabelList position="right" fill="#888" dataKey="label" stroke="none" />
                        {reportData.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Funnel>
                </FunnelChart>
            );
        }

        if (chartType === 'bubble' || chartType === 'scatter') {
            return chartContainer(
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" dataKey="x" name={config.xAxisField || 'X'} />
                    <YAxis type="number" dataKey="y" name={config.yAxisField || 'Y'} />
                    <ZAxis type="number" dataKey="z" range={[60, 400]} name={config.zAxisField || 'Z'} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Legend />
                    <Scatter name={report.name} data={reportData.chartData} fill="#0dcaf0">
                        {reportData.chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Scatter>
                </ScatterChart>
            );
        }

        if (chartType === 'gauge') {
            const data = reportData.chartData[0];
            const value = data?.value || 0;
            const max = config.max || 100;
            const gaugeData = [
                { name: 'Value', value: Math.min(value, max) },
                { name: 'Remaining', value: Math.max(0, max - value) }
            ];

            return chartContainer(
                <PieChart>
                    <Pie
                        dataKey="value"
                        startAngle={180}
                        endAngle={0}
                        data={gaugeData}
                        cx="50%"
                        cy="80%"
                        innerRadius={120}
                        outerRadius={160}
                        paddingAngle={0}
                        stroke="none"
                    >
                        <Cell key="cell-0" fill="#0dcaf0" />
                        <Cell key="cell-1" fill="#e9ecef" />
                    </Pie>
                    <Tooltip />
                    <text x="50%" y="65%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '3rem', fontWeight: 'bold', fill: '#212529' }}>
                        {value}
                    </text>
                    <text x="50%" y="78%" textAnchor="middle" dominantBaseline="middle" style={{ fill: '#6c757d', fontSize: '1.2rem' }}>
                        / {max}
                    </text>
                </PieChart>
            );
        }

        if (chartType === 'heatmap') {
            return chartContainer(
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <XAxis dataKey="x" name={config.xAxisField} />
                    <YAxis dataKey="y" name={config.yAxisField} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                    <Scatter data={reportData.chartData} shape="square">
                        {reportData.chartData.map((entry, index) => {
                            const intensity = Math.min(1, entry.value / (config.maxValue || 100));
                            return <Cell key={`cell-${index}`} fill={`rgba(13, 202, 240, ${0.2 + intensity * 0.8})`} />;
                        })}
                    </Scatter>
                </ScatterChart>
            );
        }

        return chartContainer(
            <BarChart data={reportData.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend />
                <Bar dataKey="value" name={t('value')} fill="#0dcaf0" radius={[4, 4, 0, 0]} />
            </BarChart>
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
