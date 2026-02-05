import { useState, useEffect } from 'react';
import axios from 'axios';

function LinkedRecordsModal({ moduleName, recordId, onClose }) {
    const [relations, setRelations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchRelations = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`/api/relations/used-in?module=${moduleName}&id=${recordId}`);
                setRelations(response.data);
            } catch (err) {
                setError('Failed to fetch linked records');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchRelations();
    }, [moduleName, recordId]);

    // Group relations by module
    const groupedRelations = relations.reduce((acc, rel) => {
        if (!acc[rel.module]) {
            acc[rel.module] = [];
        }
        acc[rel.module].push(rel);
        return acc;
    }, {});

    return (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content shadow-lg">
                    <div className="modal-header bg-info text-white">
                        <h5 className="modal-title">📎 Linked Records for #{recordId}</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        {loading && (
                            <div className="text-center py-4">
                                <div className="spinner-border text-primary" role="status"></div>
                                <p className="mt-2 text-muted">Fetching linked records...</p>
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-danger">{error}</div>
                        )}

                        {!loading && !error && relations.length === 0 && (
                            <div className="text-center py-4 text-muted">
                                <p className="mb-0">No records are currently referencing this record.</p>
                            </div>
                        )}

                        {!loading && !error && Object.keys(groupedRelations).map(module => (
                            <div key={module} className="mb-4">
                                <h6 className="border-bottom pb-2 mb-3">
                                    <span className="badge bg-secondary me-2">{module}</span>
                                    {groupedRelations[module].length} Records
                                </h6>
                                <div className="list-group">
                                    {groupedRelations[module].map(rel => (
                                        <div key={rel.recordId} className="list-group-item d-flex justify-content-between align-items-center">
                                            <div>
                                                <span className="text-muted me-2">#{rel.recordId}</span>
                                                <strong>{rel.display}</strong>
                                            </div>
                                            {/* Optional: Add a link to the record if we know the module ID */}
                                            <span className="badge bg-light text-dark border">
                                                Linked via relation
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LinkedRecordsModal;
