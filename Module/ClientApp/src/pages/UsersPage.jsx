import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getUsers, getRoles, assignRole, removeRole, refreshToken, createUser } from '../services/api';
import { useTenant } from '../components/TenantContext';

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
            setError(err.response?.data?.error || 'Failed to load users');
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
            alert(err.response?.data?.error || 'Failed to assign role');
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
            alert(err.response?.data?.error || 'Failed to remove role');
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
            alert('Kullanıcı başarıyla oluşturuldu');
        } catch (err) {
            alert(err.response?.data?.error || 'Kullanıcı oluşturulurken bir hata oluştu');
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
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Kullanıcı Yönetimi</h1>
                <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                    <i className="bi bi-plus-lg me-1"></i> Yeni Kullanıcı Ekle
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card shadow-sm border-0">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Kullanıcı Adı</th>
                                <th>E-posta</th>
                                <th>Roller</th>
                                <th>İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td>{user.username}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        {user.roles.map(role => (
                                            <span key={role} className="badge bg-primary me-1">
                                                {role}
                                                <button
                                                    className="btn btn-sm text-white p-0 ms-1"
                                                    onClick={() => handleRemoveRole(user.id, role)}
                                                    title="Rolü Kaldır"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </td>
                                    <td>
                                        <div className="dropdown">
                                            <button className="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                                                Rol Ekle
                                            </button>
                                            <ul className="dropdown-menu">
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
            {
                showCreateModal && (
                    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">Yeni Kullanıcı Ekle</h5>
                                    <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
                                </div>
                                <form onSubmit={handleCreateSubmit}>
                                    <div className="modal-body">
                                        <div className="mb-3">
                                            <label className="form-label">Kullanıcı Adı</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                name="username"
                                                value={newUser.username}
                                                onChange={handleNewUserChange}
                                                required
                                                minLength={3}
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">E-posta</label>
                                            <input
                                                type="email"
                                                className="form-control"
                                                name="email"
                                                value={newUser.email}
                                                onChange={handleNewUserChange}
                                                required
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">Şifre</label>
                                            <input
                                                type="password"
                                                className="form-control"
                                                name="password"
                                                value={newUser.password}
                                                onChange={handleNewUserChange}
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label">Roller</label>
                                            <div className="d-flex flex-wrap gap-2">
                                                {roles.map(role => (
                                                    <div key={role.id} className="form-check">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            id={`role-${role.id}`}
                                                            checked={newUser.roles.includes(role.name)}
                                                            onChange={() => handleNewUserRoleChange(role.name)}
                                                        />
                                                        <label className="form-check-label" htmlFor={`role-${role.id}`}>
                                                            {role.name}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>İptal</button>
                                        <button type="submit" className="btn btn-primary" disabled={createLoading}>
                                            {createLoading ? 'Kaydediliyor...' : 'Kaydet'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default UsersPage;
