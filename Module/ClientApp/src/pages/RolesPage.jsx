import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRoles, getAllPermissions, addPermissionToRole, removePermissionFromRole, createRole, updateRole, deleteRole, refreshToken } from '../services/api';
import { useTenant } from '../components/TenantContext';
import Icon from '../components/Icon';

function RolesPage() {
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const { selectedTenantId } = useTenant();

    useEffect(() => {
        loadData();
    }, [selectedTenantId]);

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
        if (!window.confirm(t('confirm_delete_role'))) return;
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
                <h1 className="display-5 fw-bold mb-0 text-gradient d-flex align-items-center gap-3">
                    <Icon name="settings" size={36} className="icon-theme" />
                    {t('role_permission_management')}
                </h1>
                <button className="btn btn-primary px-4 shadow-premium hover-lift" onClick={() => handleOpenModal()}>
                    <Icon name="plus" size={20} className="me-2" /> {t('add_new_role')}
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-4">
                {roles.map(role => (
                    <div key={role.id} className="col-md-6">
                        <div className="glass-card border-0 h-100 overflow-hidden fade-in">
                            <div className="card-header bg-surface bg-opacity-40 border-bottom border-theme-accent py-3 d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="mb-0 fw-bold">{role.name}</h5>
                                    <small className="text-muted small">{role.description}</small>
                                </div>
                                <div className="btn-group btn-group-sm">
                                    <button className="btn btn-blur d-flex align-items-center gap-1" onClick={() => handleOpenModal(role)}>
                                        <Icon name="edit" size={14} /> {t('edit')}
                                    </button>
                                    <button className="btn btn-outline-danger border-0 d-flex align-items-center gap-1" onClick={() => handleDeleteRole(role.id)}>
                                        <Icon name="delete" size={14} /> {t('delete')}
                                    </button>
                                </div>
                            </div>
                            <div className="card-body">
                                <div className="mb-3">
                                    <label className="form-label fw-bold">{t('permissions')}</label>
                                    <div className="d-flex flex-wrap gap-1">
                                        {role.permissions.map(perm => (
                                            <span key={perm} className="badge badge-outline-theme d-flex align-items-center gap-1">
                                                {perm}
                                                <button
                                                    className="btn btn-sm p-0 ms-1 lh-1 text-primary opacity-50 hover-opacity-100 border-0 bg-transparent"
                                                    onClick={() => handleRemovePermission(role.id, perm)}
                                                    style={{ fontSize: '1rem' }}
                                                >
                                                <Icon name="x" size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="dropdown">
                                    <button className="btn btn-sm btn-outline-primary dropdown-toggle rounded-pill px-3" data-bs-toggle="dropdown">
                                        <Icon name="plus" size={14} className="me-1" /> {t('add_permission')}
                                    </button>
                                    <ul className="dropdown-menu glass border-0 shadow-lg">
                                        {permissions.filter(p => !role.permissions.includes(p)).map(perm => (
                                            <li key={perm}>
                                                <button className="dropdown-item hover-bg-theme rounded-2 mx-1 my-1" style={{ width: 'calc(100% - 0.5rem)' }} onClick={() => handleAddPermission(role.id, perm)}>
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
                <div className="modal fade show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-xl overflow-hidden">
                            <div className="modal-header modal-header-premium border-0">
                                <h5 className="modal-title fw-extrabold text-gradient d-flex align-items-center gap-2">
                                    <Icon name={editingRole ? "edit" : "plus"} size={24} />
                                    {editingRole ? t('edit_role') : t('add_new_role')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={handleCloseModal}></button>
                            </div>
                            <form onSubmit={handleSaveRole}>
                                <div className="modal-body modal-body-premium" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted">{t('role_name')}</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-lg border-2"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="mb-0">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted">{t('description')}</label>
                                        <textarea
                                            className="form-control border-2"
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows="3"
                                            style={{ resize: 'none' }}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="modal-footer modal-footer-premium border-0">
                                    <button type="button" className="btn btn-blur px-4" onClick={handleCloseModal}>{t('cancel')}</button>
                                    <button type="submit" className="btn btn-primary px-5 shadow-md">{t('save_role')}</button>
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
