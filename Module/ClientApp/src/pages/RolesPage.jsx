import { useState, useEffect } from 'react';
import { getRoles, getAllPermissions, addPermissionToRole, removePermissionFromRole, createRole, updateRole, deleteRole, refreshToken } from '../services/api';

function RolesPage() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rolesData, permsData] = await Promise.all([getRoles(), getAllPermissions()]);
            setRoles(rolesData);
            setPermissions(permsData);
        } catch (err) {
            setError('Failed to load roles and permissions');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setFormData({ name: role.name, description: role.description || '' });
        } else {
            setEditingRole(null);
            setFormData({ name: '', description: '' });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingRole(null);
        setFormData({ name: '', description: '' });
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                await updateRole(editingRole.id, formData);
            } else {
                await createRole(formData);
            }
            handleCloseModal();
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save role');
        }
    };

    const handleDeleteRole = async (roleId) => {
        if (!window.confirm('Bu rolü silmek istediğinize emin misiniz?')) return;
        try {
            await deleteRole(roleId);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete role');
        }
    };

    const handleAddPermission = async (roleId, permissionName) => {
        try {
            const result = await addPermissionToRole(roleId, permissionName);

            // If the permission was added to a role the current user has, refresh their token
            if (result.shouldRefreshToken) {
                await refreshToken();
                window.location.reload();
            } else {
                loadData();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to add permission');
        }
    };

    const handleRemovePermission = async (roleId, permissionName) => {
        try {
            const result = await removePermissionFromRole(roleId, permissionName);

            // If the permission was removed from a role the current user has, refresh their token
            if (result.shouldRefreshToken) {
                await refreshToken();
                window.location.reload();
            } else {
                loadData();
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove permission');
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Rol ve İzin Yönetimi</h1>
                <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                    <i className="bi bi-plus-lg me-2"></i> Yeni Rol Ekle
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-4">
                {roles.map(role => (
                    <div key={role.id} className="col-md-6">
                        <div className="card shadow-sm border-0 h-100">
                            <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-start">
                                <div>
                                    <h5 className="mb-0">{role.name}</h5>
                                    <small className="text-muted">{role.description}</small>
                                </div>
                                <div className="btn-group">
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => handleOpenModal(role)}>
                                        Düzenle
                                    </button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRole(role.id)}>
                                        Sil
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label fw-bold">İzinler</label>
                                    <div className="d-flex flex-wrap gap-1">
                                        {role.permissions.map(perm => (
                                            <span key={perm} className="badge bg-info text-white">
                                                {perm}
                                                <button
                                                    className="btn btn-sm text-white p-0 ms-1"
                                                    onClick={() => handleRemovePermission(role.id, perm)}
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="dropdown">
                                    <button className="btn btn-sm btn-outline-primary dropdown-toggle" data-bs-toggle="dropdown">
                                        İzin Ekle
                                    </button>
                                    <ul className="dropdown-menu">
                                        {permissions.filter(p => !role.permissions.includes(p)).map(perm => (
                                            <li key={perm}>
                                                <button className="dropdown-item" onClick={() => handleAddPermission(role.id, perm)}>
                                                    {perm}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Role Modal */}
            {showModal && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">{editingRole ? 'Rolü Düzenle' : 'Yeni Rol Ekle'}</h5>
                                <button type="button" className="btn-close" onClick={handleCloseModal}></button>
                            </div>
                            <form onSubmit={handleSaveRole}>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label">Rol Adı</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Açıklama</label>
                                        <textarea
                                            className="form-control"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows="3"
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>İptal</button>
                                    <button type="submit" className="btn btn-primary">Kaydet</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RolesPage;
