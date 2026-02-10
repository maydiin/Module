import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getUsers, getRoles, assignRole, removeRole } from '../services/api';

function UsersPage() {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadData();
    }, []);

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
            await assignRole(userId, roleName);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to assign role');
        }
    };

    const handleRemoveRole = async (userId, roleName) => {
        try {
            await removeRole(userId, roleName);
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove role');
        }
    };

    if (loading) return <div className="text-center py-5"><div className="spinner-border text-primary"></div></div>;

    return (
        <div className="fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Kullanıcı Yönetimi</h1>
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
        </div>
    );
}

export default UsersPage;
