import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { getUsers, getRoles, assignRole, removeRole, refreshToken, createUser, updateUser, getModules, getRecords } from '../services/api';
import { useTenant } from '../components/TenantContext';
import Icon from '../components/Icon';
import { useToast } from '../components/ToastContext';

function getRecordLabel(record) {
    try {
        const data = typeof record.data === 'string' ? JSON.parse(record.data) : (record.data || {});
        const firstStr = Object.values(data).find(v => typeof v === 'string' && v.trim());
        return firstStr ? `${firstStr} (#${record.id})` : `#${record.id}`;
    } catch {
        return `#${record.id}`;
    }
}

const emptyUser = { username: '', email: '', password: '', roles: [], linkedModuleId: null, linkedRecordId: null };

function ModuleLinkSection({ modules, linkedModuleId, linkedRecordId, records, recordsLoading, onModuleChange, onRecordChange, onClear }) {
    return (
        <div className="mb-4">
            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-2 font-heading d-flex align-items-center gap-2">
                <Icon name="link" size={14} /> {t('module_link')}
                <span className="badge bg-secondary bg-opacity-20 text-secondary fw-normal px-2">{t('optional_badge')}</span>
            </label>
            <div className="bg-surface bg-opacity-40 rounded-4 border border-theme-accent p-3">
                <div className="row g-3">
                    <div className="col-md-6">
                        <label className="form-label small text-muted mb-1">{t('module')}</label>
                        <select
                            className="form-select border-2 shadow-sm rounded-3"
                            value={linkedModuleId || ''}
                            onChange={e => onModuleChange(e.target.value ? parseInt(e.target.value) : null)}
                        >
                            <option value="">{t('select_module_placeholder')}</option>
                            {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                    </div>
                    <div className="col-md-6">
                        <label className="form-label small text-muted mb-1">{t('record')}</label>
                        <select
                            className="form-select border-2 shadow-sm rounded-3"
                            value={linkedRecordId || ''}
                            onChange={e => onRecordChange(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!linkedModuleId || recordsLoading}
                        >
                            <option value="">{t('select_record_placeholder')}</option>
                            {recordsLoading
                                ? <option disabled>{t('loading_dots')}</option>
                                : records.map(r => <option key={r.id} value={r.id}>{getRecordLabel(r)}</option>)
                            }
                        </select>
                    </div>
                </div>
                {linkedModuleId && (
                    <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={onClear}>
                        <Icon name="x" size={12} className="me-1" /> {t('remove_link')}
                    </button>
                )}
            </div>
        </div>
    );
}

function UsersPage() {
    const { t } = useTranslation();
    const showToast = useToast();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const { selectedTenantId } = useTenant();

    // Create state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [newUser, setNewUser] = useState(emptyUser);
    const [createRecords, setCreateRecords] = useState([]);
    const [createRecordsLoading, setCreateRecordsLoading] = useState(false);

    // Edit state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editUser, setEditUser] = useState(emptyUser);
    const [editRecords, setEditRecords] = useState([]);
    const [editRecordsLoading, setEditRecordsLoading] = useState(false);

    useEffect(() => { loadData(); }, [selectedTenantId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [usersData, rolesData, modulesData] = await Promise.all([getUsers(), getRoles(), getModules()]);
            setUsers(usersData);
            setRoles(rolesData);
            setModules(modulesData);
        } catch (err) {
            setError(err.response?.data?.error || t('error'));
        } finally {
            setLoading(false);
        }
    };

    const fetchRecords = async (moduleId, setter, loadingSetter) => {
        if (!moduleId) { setter([]); return; }
        loadingSetter(true);
        try {
            const data = await getRecords(moduleId);
            setter(Array.isArray(data) ? data : (data.items || []));
        } catch {
            setter([]);
        } finally {
            loadingSetter(false);
        }
    };

    const handleAssignRole = async (userId, roleName) => {
        try {
            const result = await assignRole(userId, roleName);
            if (result.shouldRefreshToken) { await refreshToken(); window.location.reload(); }
            else loadData();
        } catch (err) {
            showToast(err.response?.data?.error || t('error'), 'error');
        }
    };

    const handleRemoveRole = async (userId, roleName) => {
        try {
            const result = await removeRole(userId, roleName);
            if (result.shouldRefreshToken) { await refreshToken(); window.location.reload(); }
            else loadData();
        } catch (err) {
            showToast(err.response?.data?.error || t('error'), 'error');
        }
    };

    // Create handlers
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        try {
            await createUser(newUser);
            setShowCreateModal(false);
            setNewUser(emptyUser);
            setCreateRecords([]);
            loadData();
            showToast(t('user_created_success'), 'success');
        } catch (err) {
            showToast(err.response?.data?.error || t('user_create_error'), 'error');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleNewUserChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prev => ({ ...prev, [name]: value }));
    };

    const handleNewUserRoleChange = (roleName) => {
        setNewUser(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName) ? prev.roles.filter(r => r !== roleName) : [...prev.roles, roleName]
        }));
    };

    const handleCreateModuleChange = (moduleId) => {
        setNewUser(prev => ({ ...prev, linkedModuleId: moduleId, linkedRecordId: null }));
        fetchRecords(moduleId, setCreateRecords, setCreateRecordsLoading);
    };

    // Edit handlers
    const openEditModal = async (user) => {
        setEditingUserId(user.id);
        setEditUser({
            username: user.username,
            email: user.email,
            password: '',
            roles: [...user.roles],
            linkedModuleId: user.linkedModuleId || null,
            linkedRecordId: user.linkedRecordId || null
        });
        setShowEditModal(true);
        if (user.linkedModuleId) {
            fetchRecords(user.linkedModuleId, setEditRecords, setEditRecordsLoading);
        } else {
            setEditRecords([]);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setEditLoading(true);
        try {
            const payload = { ...editUser, password: editUser.password || null };
            await updateUser(editingUserId, payload);
            setShowEditModal(false);
            loadData();
            showToast(t('user_updated_success'), 'success');
        } catch (err) {
            showToast(err.response?.data?.error || t('error'), 'error');
        } finally {
            setEditLoading(false);
        }
    };

    const handleEditUserChange = (e) => {
        const { name, value } = e.target;
        setEditUser(prev => ({ ...prev, [name]: value }));
    };

    const handleEditUserRoleChange = (roleName) => {
        setEditUser(prev => ({
            ...prev,
            roles: prev.roles.includes(roleName) ? prev.roles.filter(r => r !== roleName) : [...prev.roles, roleName]
        }));
    };

    const handleEditModuleChange = (moduleId) => {
        setEditUser(prev => ({ ...prev, linkedModuleId: moduleId, linkedRecordId: null }));
        fetchRecords(moduleId, setEditRecords, setEditRecordsLoading);
    };

    const RolesCheckboxes = ({ selectedRoles, onToggle, idPrefix }) => (
        <div className="bg-surface bg-opacity-40 rounded-4 border border-theme-accent shadow-inner p-4" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <div className="row g-3">
                {roles.map(role => (
                    <div key={role.id} className="col-sm-6 col-md-4">
                        <div
                            className={`form-check p-3 rounded-3 border-2 transition-all ${selectedRoles.includes(role.name) ? 'bg-surface border-primary shadow-sm' : 'bg-surface bg-opacity-50 border-theme-accent border-opacity-30 opacity-80'}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onToggle(role.name)}
                        >
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id={`${idPrefix}-${role.id}`}
                                checked={selectedRoles.includes(role.name)}
                                onChange={() => {}}
                            />
                            <label className="form-check-label fw-bold small ms-2" htmlFor={`${idPrefix}-${role.id}`} style={{ pointerEvents: 'none' }}>
                                {role.name}
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

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
                        <Icon name="plus" size={18} className="me-1 me-md-2" />
                        <span className="d-none d-sm-inline">{t('add_new_user')}</span>
                        <span className="d-sm-none">{t('add')}</span>
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
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary d-none d-md-table-cell">{t('linked_record')}</th>
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary">{t('roles')}</th>
                                <th className="px-3 px-md-4 py-4 small fw-bold text-uppercase tracking-wider border-0 text-primary">{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-3 px-md-4 py-3 fw-medium">{user.username}</td>
                                    <td className="px-3 px-md-4 py-3 text-muted d-none d-sm-table-cell">{user.email}</td>
                                    <td className="px-3 px-md-4 py-3 d-none d-md-table-cell">
                                        {user.linkedModuleName ? (
                                            <span className="badge badge-outline-theme d-inline-flex align-items-center gap-1">
                                                <Icon name="link" size={11} />
                                                {user.linkedModuleName}
                                                {user.linkedRecordId && <span className="opacity-60 ms-1">#{user.linkedRecordId}</span>}
                                            </span>
                                        ) : (
                                            <span className="text-muted opacity-40 small">—</span>
                                        )}
                                    </td>
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
                                        <div className="d-flex gap-2 align-items-center flex-wrap">
                                            <button
                                                className="btn btn-sm btn-blur rounded-pill px-3"
                                                onClick={() => openEditModal(user)}
                                            >
                                                <Icon name="edit" size={13} className="me-1" />
                                                <span className="d-none d-md-inline">{t('edit')}</span>
                                            </button>
                                            <div className="dropdown">
                                                <button className="btn btn-sm btn-blur rounded-pill px-3 dropdown-toggle" data-bs-toggle="dropdown">
                                                    <Icon name="plus" size={13} className="me-1" />
                                                    <span className="d-none d-md-inline">{t('add_role')}</span>
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
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('email')}</label>
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

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('password')}</label>
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

                                    <ModuleLinkSection
                                        modules={modules}
                                        linkedModuleId={newUser.linkedModuleId}
                                        linkedRecordId={newUser.linkedRecordId}
                                        records={createRecords}
                                        recordsLoading={createRecordsLoading}
                                        onModuleChange={handleCreateModuleChange}
                                        onRecordChange={v => setNewUser(prev => ({ ...prev, linkedRecordId: v }))}
                                        onClear={() => { setNewUser(prev => ({ ...prev, linkedModuleId: null, linkedRecordId: null })); setCreateRecords([]); }}
                                    />

                                    <div className="mb-0">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-3 font-heading">
                                            {t('roles')} <span className="badge badge-outline-theme ms-2 px-2 py-1">{roles.length} {t('total')}</span>
                                        </label>
                                        <RolesCheckboxes selectedRoles={newUser.roles} onToggle={handleNewUserRoleChange} idPrefix="create-role" />
                                        <p className="text-muted small mt-2 mb-0 opacity-60">
                                            <Icon name="lightbulb" size={16} className="me-1 text-primary" />
                                            {t('user_roles_help')}
                                        </p>
                                    </div>
                                </div>
                                <div className="modal-footer modal-footer-premium border-0 py-4 px-4">
                                    <button type="button" className="btn btn-blur px-5 h6 mb-0" onClick={() => setShowCreateModal(false)}>{t('cancel')}</button>
                                    <button type="submit" className="btn btn-primary px-5 py-3 shadow-premium fw-extrabold text-uppercase h6 mb-0" disabled={createLoading}>
                                        {createLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>{t('saving')}</> : t('save_user')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit User Modal */}
            {showEditModal && createPortal(
                <div className="modal show d-block glass-modal" tabIndex="-1">
                    <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
                        <div className="modal-content border-0 shadow-xl overflow-hidden">
                            <div className="modal-header modal-header-premium border-0">
                                <h5 className="modal-title fw-extrabold text-gradient d-flex align-items-center gap-2">
                                    <Icon name="edit" size={24} /> {t('edit_user')}
                                </h5>
                                <button type="button" className="btn-close btn-close-premium" onClick={() => setShowEditModal(false)}></button>
                            </div>
                            <form onSubmit={handleEditSubmit}>
                                <div className="modal-body modal-body-premium" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' }}>
                                    <div className="row g-4 mb-4">
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('username')}</label>
                                            <input
                                                type="text"
                                                className="form-control border-2 shadow-sm rounded-3"
                                                name="username"
                                                value={editUser.username}
                                                onChange={handleEditUserChange}
                                                minLength={3}
                                            />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading">{t('email')}</label>
                                            <input
                                                type="email"
                                                className="form-control border-2 shadow-sm rounded-3"
                                                name="email"
                                                value={editUser.email}
                                                onChange={handleEditUserChange}
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted font-heading d-flex align-items-center gap-2">
                                            {t('password')}
                                            <span className="badge bg-secondary bg-opacity-20 text-secondary fw-normal px-2">{t('fill_to_change_password')}</span>
                                        </label>
                                        <input
                                            type="password"
                                            className="form-control border-2 shadow-sm rounded-3"
                                            name="password"
                                            placeholder="••••••••"
                                            value={editUser.password}
                                            onChange={handleEditUserChange}
                                            minLength={6}
                                        />
                                    </div>

                                    <ModuleLinkSection
                                        modules={modules}
                                        linkedModuleId={editUser.linkedModuleId}
                                        linkedRecordId={editUser.linkedRecordId}
                                        records={editRecords}
                                        recordsLoading={editRecordsLoading}
                                        onModuleChange={handleEditModuleChange}
                                        onRecordChange={v => setEditUser(prev => ({ ...prev, linkedRecordId: v }))}
                                        onClear={() => { setEditUser(prev => ({ ...prev, linkedModuleId: null, linkedRecordId: null })); setEditRecords([]); }}
                                    />

                                    <div className="mb-0">
                                        <label className="form-label small fw-bold text-uppercase tracking-wider text-muted mb-3 font-heading">{t('roles')}</label>
                                        <RolesCheckboxes selectedRoles={editUser.roles} onToggle={handleEditUserRoleChange} idPrefix="edit-role" />
                                    </div>
                                </div>
                                <div className="modal-footer modal-footer-premium border-0 py-4 px-4">
                                    <button type="button" className="btn btn-blur px-5 h6 mb-0" onClick={() => setShowEditModal(false)}>{t('cancel')}</button>
                                    <button type="submit" className="btn btn-primary px-5 py-3 shadow-premium fw-extrabold text-uppercase h6 mb-0" disabled={editLoading}>
                                        {editLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>{t('saving')}</> : t('update')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default UsersPage;
