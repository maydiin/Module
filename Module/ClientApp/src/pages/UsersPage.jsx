import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getUsers, getRoles, assignRole, removeRole, refreshToken, createUser } from '../services/api';
import { useTenant } from '../components/TenantContext';
import Icon from '../components/Icon';

function UsersPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { selectedTenantId } = useTenant();

    // Create User State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        password: '',
        roles: []
    });

    useEffect(() => {
        loadData();
    }, [selectedTenantId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersData, rolesData] = await Promise.all([getUsers(), getRoles()]);
            setUsers(usersData);
            setRoles(rolesData);
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const handleAssignRole = async (userId, roleName) => {
        try {
            const result = await assignRole(userId, roleName);

            // If the role was assigned to the current user, refresh their token
            if (result.shouldRefreshToken) {
                await refreshToken();
                window.location.reload();
            } else {
                loadData();
            }
        } catch (err) {
            alert(err.response?.data?.error || t('error'));
        }
    };

    const handleRemoveRole = async (userId, roleName) => {
        try {
            const result = await removeRole(userId, roleName);

            // If the role was removed from the current user, refresh their token
            if (result.shouldRefreshToken) {
                await refreshToken();
                window.location.reload();
            } else {
                loadData();
            }
        } catch (err) {
            alert(err.response?.data?.error || t('error'));
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            await createUser(newUser);
            setShowCreateModal(false);
            setNewUser({ username: '', email: '', password: '', roles: [] });
            loadData();
            alert(t('user_created_success'));
        } catch (err) {
            alert(err.response?.data?.error || t('user_create_error'));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleNewUserChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNewUserRoleChange = (roleName) => {
        setNewUser(prev => {
            const roles = prev.roles.includes(roleName)
                ? prev.roles.filter(r => r !== roleName)
                : [...prev.roles, roleName];
            return { ...prev, roles };
        });
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="fade-in">
            <div className="page-header mb-4">
                <h1 className="display-5 fw-bold mb-0 text-gradient d-flex align-items-center gap-2 gap-md-3">
                    <Icon name="settings" size={36} className="icon-theme" />
                    {t('user_management')}
                </h1>
                <div className="page-header-actions">
                    <button className="btn btn-primary px-3 px-md-4 shadow-premium hover-lift" onClick={() => setShowCreateModal(true)}>
                        <Icon name="plus" size={18} className="me-1 me-md-2" /> <span className="d-none d-sm-inline">{t('add_new_user')}</span><span className="d-sm-none">{t('add')}</span>
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="glass-card border-0" style={{ paddingBottom: '3rem' }}>
                <div className="table-responsive" style={{ overflow: 'visible' }}>
                    <table className="table table-hover align-middle mb-0">
                        <thead className="bg-surface bg-opacity-50">
                            <tr className="border-bottom border-theme-accent">
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary">{t('username')}</th>
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary d-none d-sm-table-cell">{t('email')}</th>
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary">{t('roles')}</th>
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-3 px-md-4 py-3 fw-medium">{user.username}</td>
                                    <td className="px-3 px-md-4 py-3 text-muted d-none d-sm-table-cell">{user.email}</td>
                                    <td className="px-3 px-md-4 py-3">
                                        <div className="d-flex flex-wrap gap-1">
                                            {user.roles.map(role => (
                                                <span key={role} className="badge badge-outline-theme d-inline-flex align-items-center">
                                                    {role}
                                                    <button
                                                        className="btn btn-sm text-inherit p-0 ms-1 d-flex align-items-center"
                                                        onClick={() => handleRemoveRole(user.id, role)}
                                                        title={t('remove_role')}
                                                        style={{ opacity: 0.7 }}
                                                    >
                                                        <Icon name="x" size={11} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-3 px-md-4 py-3">
                                        <div className="dropdown">
                                            <button className="btn btn-sm btn-blur rounded-pill px-3 dropdown-toggle" data-bs-toggle="dropdown">
                                                <Icon name="plus" size={13} className="me-1" /> <span className="d-none d-md-inline">{t('add_role')}</span>
                                            </button>
                                            <ul className="dropdown-menu shadow-lg border-0">
                                                {roles.filter(r => !user.roles.includes(r.name)).map(role => (
                                                    <li key={role.id}>
                                                        <button className="dropdown-item" onClick={() => handleAssignRole(user.id, role.name)}>
                                                            {role.name}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Create User Modal */}
            {showCreateModal && createPortal(
                <div className="modal show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-xl overflow-hidden">
                            <div className="modal-header modal-header-premium border-0">
                                <h5 className="modal-title fw-extrabold text-gradient d-flex align-items-center gap-2">
                                    <Icon name="plus" size={24} /> {t('add_new_user')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowCreateModal(false)}></button>
                            </div>
                            <form onSubmit={handleCreateSubmit}>
                                <div className="modal-body modal-body-premium" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                    <div className="row g-4 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('username')}</label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control border-2 shadow-sm rounded-3"
                                                    name="username"
                                                    placeholder={t('username')}
                                                    value={newUser.username}
                                                    onChange={handleNewUserChange}
                                                    required
                                                    minLength={3}
                                                />
                                            </div>
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('email')}</label>
                                            <div className="input-group">
                                                <input
                                                    type="email"
                                                    className="form-control border-2 shadow-sm rounded-3"
                                                    name="email"
                                                    placeholder="example@email.com"
                                                    value={newUser.email}
                                                    onChange={handleNewUserChange}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('password')}</label>
                                        <div className="input-group">
                                            <input
                                                type="password"
                                                className="form-control border-2 shadow-sm rounded-3"
                                                name="password"
                                                placeholder="••••••••"
                                                value={newUser.password}
                                                onChange={handleNewUserChange}
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-0">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-3 font-heading">
                                            {t('roles')} <span className="badge badge-outline-theme ms-2 px-2 py-1">{roles.length} {t('total')}</span>
                                        </label>
                                        <div 
                                            className="bg-surface bg-opacity-40 rounded-4 border border-theme-accent shadow-inner p-4" 
                                            style={{ maxHeight: '200px', overflowY: 'auto' }}
                                        >
                                            <div className="row g-3">
                                                {roles.map(role => (
                                                    <div key={role.id} className="col-sm-6 col-md-4">
                                                        <div 
                                                            className={`form-check p-3 rounded-3 border-2 transition-all ${newUser.roles.includes(role.name) ? 'bg-surface border-primary shadow-sm' : 'bg-surface bg-opacity-50 border-theme-accent border-opacity-30 opacity-80'}`}
                                                            style={{ cursor: 'pointer' }}
                                                            onClick={() => handleNewUserRoleChange(role.name)}
                                                        >
                                                            <input
                                                                className="form-check-input"
                                                                type="checkbox"
                                                                id={`role-${role.id}`}
                                                                checked={newUser.roles.includes(role.name)}
                                                                onChange={() => {}} // Controlled via parent div click
                                                            />
                                                            <label 
                                                                className="form-check-label fw-bold small ms-2" 
                                                                htmlFor={`role-${role.id}`}
                                                                style={{ pointerEvents: 'none' }}
                                                            >
                                                                {role.name}
                                                            </label>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-muted small mt-2 mb-0 opacity-60">
                                            <Icon name="lightbulb" size={16} className="me-1 text-primary" />
                                            {t('user_roles_help')}
                                        </p>
                                    </div>
                                </div>
                                <div className="modal-footer modal-footer-premium border-0 py-4 px-4">
                                    <button type="button" className="btn btn-blur px-5 h6 mb-0" onClick={() => setShowCreateModal(false)}>{t('cancel')}</button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary px-5 py-3 shadow-premium fw-extrabold text-uppercase h6 mb-0" 
                                        disabled={createLoading}
                                    >
                                        {createLoading ? (
                                            <><span className="spinner-border spinner-border-sm me-2"></span>{t('saving')}</>
                                        ) : t('save_user')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
}

export default UsersPage;
