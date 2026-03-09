import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules } from '../../services/api';
import { useTenant } from '../TenantContext';

function Sidebar({ isOpen = true, className = '' }) {
    const { t } = useTranslation();
    const location = useLocation();
    const { selectedTenantId } = useTenant();
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedModule, setExpandedModule] = useState(null);

    useEffect(() => {
        loadModules();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTenantId]);

    // When route changes, try to auto-expand the active module menu
    useEffect(() => {
        if (location.pathname.startsWith('/modules/')) {
            const parts = location.pathname.split('/');
            if (parts.length >= 3) {
                setExpandedModule(Number(parts[2]));
            }
        } else {
            setExpandedModule(null);
        }
    }, [location.pathname]);

    const loadModules = async () => {
        try {
            setLoading(true);
            const data = await getModules();
            setModules(data);
        } catch (err) {
            console.error('Failed to load modules for sidebar:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleModule = (moduleId) => {
        setExpandedModule(expandedModule === moduleId ? null : moduleId);
    };

    // Filter modules based on View permission (Super Admin sees all)
    const permissionsJson = localStorage.getItem('permissions');
    const userPermissions = permissionsJson ? JSON.parse(permissionsJson) : [];
    const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';

    const visibleModules = isSuperAdmin
        ? modules
        : modules.filter(m => userPermissions.includes(`Module.${m.name}.View`));

    if (loading) {
        return (
            <div className={`p-4 text-center transition-all ${className}`} style={{ width: isOpen ? '280px' : '0px', overflow: 'hidden' }}>
                <div className="spinner-border spinner-border-sm text-primary" role="status" style={{ opacity: isOpen ? 1 : 0 }}>
                    <span className="visually-hidden">{t('loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`bg-white border-end shadow-sm transition-all ${className}`}
            style={{
                width: isOpen ? '280px' : '0px',
                minHeight: '100%',
                overflowY: isOpen ? 'auto' : 'hidden',
                overflowX: 'hidden'
            }}
        >
            <div style={{ width: '280px', opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s', visibility: isOpen ? 'visible' : 'hidden' }}>
                <div className="p-3">
                    <h6 className="text-uppercase text-muted fw-bold mb-3 small tracking-wider">{t('modules_title')}</h6>
                    {visibleModules.length === 0 ? (
                        <p className="text-muted small">{t('empty_workspace_desc')}</p>
                    ) : (
                        <ul className="list-unstyled mb-0">
                            {visibleModules.map(module => {
                                const isExpanded = expandedModule === module.id;

                                // Determine if we show specific links based on permissions
                                const canManage = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Manage`);
                                const canView = isSuperAdmin || userPermissions.includes(`Module.${module.name}.View`);
                                const canApi = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Api`);
                                const canScript = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Script`);

                                return (
                                    <li key={module.id} className="mb-1">
                                        <button
                                            className={`btn btn-toggle d-flex align-items-center rounded border-0 w-100 text-start px-2 py-2 fw-medium ${isExpanded ? 'bg-light text-primary' : 'hover-bg-accent text-dark'}`}
                                            onClick={() => toggleModule(module.id)}
                                            aria-expanded={isExpanded}
                                        >
                                            <span className="me-2 opacity-75">📁</span>
                                            <span className="flex-grow-1 text-truncate">{module.name}</span>
                                            <span className="ms-auto opacity-50 small">
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="collapse show">
                                                <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small ps-4 mt-1">
                                                    {canView && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/records`}
                                                                className={({ isActive }) => `text-decoration-none d-block py-1 px-2 rounded ${isActive ? 'bg-primary bg-opacity-10 text-primary fw-bold' : 'text-body hover-bg-light'}`}
                                                            >
                                                                📋 {t('records')}
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canManage && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/fields`}
                                                                className={({ isActive }) => `text-decoration-none d-block py-1 px-2 rounded ${isActive ? 'bg-primary bg-opacity-10 text-primary fw-bold' : 'text-body hover-bg-light'}`}
                                                            >
                                                                ⚙️ {t('fields')}
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canApi && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/api-configs`}
                                                                className={({ isActive }) => `text-decoration-none d-block py-1 px-2 rounded ${isActive ? 'bg-primary bg-opacity-10 text-primary fw-bold' : 'text-body hover-bg-light'}`}
                                                            >
                                                                🔌 API
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canScript && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/scripts`}
                                                                className={({ isActive }) => `text-decoration-none d-block py-1 px-2 rounded ${isActive ? 'bg-primary bg-opacity-10 text-primary fw-bold' : 'text-body hover-bg-light'}`}
                                                            >
                                                                📜 Scripts
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Sidebar;
