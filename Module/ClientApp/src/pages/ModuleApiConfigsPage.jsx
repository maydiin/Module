import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getModule, getApiConfigs, createApiConfig, updateApiConfig, deleteApiConfig } from '../services/api';

function ModuleApiConfigsPage() {
    const { moduleId } = useParams();
    const navigate = useNavigate();
    const [module, setModule] = useState(null);
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editConfigId, setEditConfigId] = useState(null);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        method: 'POST',
        headersJson: '',
        requestBodyTemplate: '',
        responseMappingsJson: ''
    });

    useEffect(() => {
        loadData();
    }, [moduleId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [moduleData, configsData] = await Promise.all([
                getModule(moduleId),
                getApiConfigs(moduleId)
            ]);
            setModule(moduleData);
            setConfigs(configsData);
        } catch (err) {
            setError('Failed to load API configurations');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (config) => {
        setEditConfigId(config.id);
        setFormData({
            name: config.name,
            url: config.url,
            method: config.method,
            headersJson: config.headersJson || '',
            requestBodyTemplate: config.requestBodyTemplate || '',
            responseMappingsJson: config.responseMappingsJson || ''
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name || !formData.url) {
            setError('Name and URL are required');
            return;
        }

        try {
            if (editConfigId) {
                await updateApiConfig(moduleId, editConfigId, formData);
            } else {
                await createApiConfig(moduleId, formData);
            }
            resetForm();
            loadData();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${editConfigId ? 'update' : 'create'} API configuration`);
            console.error(err);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            url: '',
            method: 'POST',
            headersJson: '',
            requestBodyTemplate: '',
            responseMappingsJson: ''
        });
        setEditConfigId(null);
        setShowForm(false);
    };

    const handleDelete = async (configId) => {
        if (!window.confirm('Are you sure you want to delete this configuration?')) return;
        try {
            await deleteApiConfig(moduleId, configId);
            loadData();
        } catch (err) {
            setError('Failed to delete configuration');
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item"><Link to="/">Modules</Link></li>
                    <li className="breadcrumb-item active">{module?.name} API Configs</li>
                </ol>
            </nav>

            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-0">External API Configurations</h1>
                    <p className="text-muted">Manage external API integrations for {module?.name}</p>
                </div>
                <button
                    className={`btn ${showForm ? 'btn-outline-danger' : 'btn-primary'}`}
                    onClick={() => {
                        if (showForm) resetForm();
                        else setShowForm(true);
                    }}
                >
                    {showForm ? 'Cancel' : '+ Add New Config'}
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {showForm && (
                <div className="card shadow mb-4 border-0">
                    <div className={`card-header ${editConfigId ? 'bg-primary' : 'bg-dark'} text-white border-0 py-3`}>
                        <h5 className="mb-0">{editConfigId ? 'Edit API Configuration' : 'New API Configuration'}</h5>
                    </div>
                    <div className="card-body bg-light">
                        <form onSubmit={handleSubmit}>
                            <div className="row">
                                <div className="col-md-8 mb-3">
                                    <label className="form-label fw-bold">Integration Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. Identity Verification"
                                    />
                                </div>
                                <div className="col-md-4 mb-3">
                                    <label className="form-label fw-bold">HTTP Method</label>
                                    <select
                                        className="form-select"
                                        value={formData.method}
                                        onChange={e => setFormData({ ...formData, method: e.target.value })}
                                    >
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                        <option value="PUT">PUT</option>
                                        <option value="DELETE">DELETE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-3">
                                <label className="form-label fw-bold">API URL</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={formData.url}
                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                    placeholder="https://api.example.com/v1/user/{{TCNo}}"
                                />
                                <small className="text-muted">Use <code>{`{{FieldName}}`}</code> for dynamic placeholders.</small>
                            </div>

                            <div className="mb-3">
                                <label className="form-label fw-bold">Custom Headers (JSON Dictionary)</label>
                                <textarea
                                    className="form-control font-monospace"
                                    rows="2"
                                    value={formData.headersJson}
                                    onChange={e => setFormData({ ...formData, headersJson: e.target.value })}
                                    placeholder='{ "Authorization": "Bearer token", "X-Custom": "value" }'
                                ></textarea>
                            </div>

                            <div className="row">
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-bold">Request Body Template (JSON)</label>
                                    <textarea
                                        className="form-control font-monospace"
                                        rows="4"
                                        value={formData.requestBodyTemplate}
                                        onChange={e => setFormData({ ...formData, requestBodyTemplate: e.target.value })}
                                        placeholder='{ "userId": {{Id}}, "action": "verify" }'
                                    ></textarea>
                                </div>
                                <div className="col-md-6 mb-3">
                                    <label className="form-label fw-bold">Response Mappings (JSON)</label>
                                    <textarea
                                        className="form-control font-monospace"
                                        rows="4"
                                        value={formData.responseMappingsJson}
                                        onChange={e => setFormData({ ...formData, responseMappingsJson: e.target.value })}
                                        placeholder='{ "result.status": "IsVerified", "result.id": "ExternalId" }'
                                    ></textarea>
                                    <small className="text-muted">Map API paths to Module fields.</small>
                                </div>
                            </div>

                            <div className="d-flex justify-content-end gap-2 mt-2">
                                <button type="button" className="btn btn-outline-secondary px-4" onClick={resetForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary px-5 fw-bold">{editConfigId ? 'Update' : 'Save'} Configuration</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="row g-4">
                {configs.length === 0 ? (
                    <div className="col-12">
                        <div className="text-center py-5 bg-light rounded-3 border mt-3">
                            <span className="display-1 text-muted opacity-25">🔌</span>
                            <p className="mt-3 text-muted">No API configurations found for {module?.name}.</p>
                        </div>
                    </div>
                ) : (
                    configs.map(config => (
                        <div key={config.id} className="col-md-6">
                            <div className="card h-100 shadow-sm border-0">
                                <div className="card-header bg-white border-0 pt-3 d-flex justify-content-between align-items-start">
                                    <div>
                                        <span className={`badge bg-${config.method === 'GET' ? 'success' : 'primary'} mb-2`}>{config.method}</span>
                                        <h5 className="mb-0">{config.name}</h5>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-outline-primary btn-sm border-0" onClick={() => handleEdit(config)} title="Edit Configuration">
                                            <span>📝 Edit</span>
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm border-0" onClick={() => handleDelete(config.id)} title="Delete Configuration">
                                            <span>🗑️</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="card-body">
                                    <div className="bg-light p-2 rounded mb-3">
                                        <code className="small text-break">{config.url}</code>
                                    </div>

                                    <div className="row g-2 mb-3">
                                        <div className="col-6">
                                            <div className="border rounded p-2 text-center h-100 bg-white">
                                                <div className="small text-muted mb-1">Headers</div>
                                                <div className="fw-bold">{config.headersJson ? 'Yes ✅' : 'No'}</div>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <div className="border rounded p-2 text-center h-100 bg-white">
                                                <div className="small text-muted mb-1">Mappings</div>
                                                <div className="fw-bold">{config.responseMappingsJson ? 'Yes ✅' : 'No'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {config.requestBodyTemplate && (
                                        <div className="small mb-2">
                                            <div className="fw-bold mb-1">Body Template:</div>
                                            <pre className="bg-dark text-light p-2 rounded small overflow-auto" style={{ maxHeight: '100px' }}>
                                                {config.requestBodyTemplate}
                                            </pre>
                                        </div>
                                    )}

                                    {config.responseMappingsJson && (
                                        <div className="small">
                                            <div className="fw-bold mb-1">Mappings:</div>
                                            <pre className="bg-light border p-2 rounded small overflow-auto" style={{ maxHeight: '100px' }}>
                                                {config.responseMappingsJson}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ModuleApiConfigsPage;
