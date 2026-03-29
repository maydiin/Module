import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getModules } from '../../services/api';
import { useTenant } from '../TenantContext';
import { useAuth } from '../AuthContext';

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

    const { permissions: userPermissions, isSuperAdmin, hasPermission } = useAuth();
    const visibleModules = isSuperAdmin
        ? modules
        : modules.filter(m => hasPermission(`Module.${m.name}.View`));

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
            className={`transition-all ${className}`}
            style={{
                width: isOpen ? '300px' : '0px',
                minHeight: '100%',
                overflow: 'hidden',
                zIndex: 1010,
                padding: isOpen ? '1rem' : '0',
                pointerEvents: isOpen ? 'all' : 'none'
            }}
        >
            <div 
                className="glass-card h-100 overflow-auto border-0" 
                style={{ 
                    opacity: isOpen ? 1 : 0, 
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    visibility: isOpen ? 'visible' : 'hidden',
                    borderRadius: '24px'
                }}
            >
                <div className="py-4 px-3" style={{ width: '268px' }}>
                    <div className="mb-4 ps-2">
                        <h6 className="text-uppercase text-muted fw-bold small tracking-wider" style={{ fontSize: '0.65rem', opacity: 0.8 }}>
                            {t('modules_title')}
                        </h6>
                    </div>
                    {visibleModules.length === 0 ? (
                        <p className="text-muted small ps-2" style={{ opacity: 0.8 }}>{t('empty_workspace_desc')}</p>
                    ) : (
                        <ul className="list-unstyled mb-0 stagger-in">
                            {visibleModules.map(module => {
                                const isExpanded = expandedModule === module.id;

                                // Determine if we show specific links based on permissions
                                const canManage = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Manage`);
                                const canView = isSuperAdmin || userPermissions.includes(`Module.${module.name}.View`);
                                const canApi = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Api`);
                                const canScript = isSuperAdmin || userPermissions.includes(`Module.${module.name}.Script`);

                                return (
                                    <li key={module.id} className="mb-2">
                                        <button
                                            className={`btn border-0 w-100 text-start px-3 py-2 fw-bold transition-all d-flex align-items-center ${isExpanded ? 'menu-active' : 'text-nav bg-primary bg-opacity-5 hover-bg-theme'}`}
                                            onClick={() => toggleModule(module.id)}
                                            aria-expanded={isExpanded}
                                            style={{ height: '52px', borderRadius: '16px', backdropFilter: 'blur(5px)' }}
                                        >
                                            <div className="d-flex align-items-center flex-grow-1 overflow-hidden">
                                                <span className={`me-3 fs-5 transition-all ${isExpanded ? 'scale-110' : 'opacity-70'}`}>
                                                    {isExpanded ? '📂' : '📁'}
                                                </span>
                                                <span className="text-truncate" style={{ fontSize: '0.925rem' }}>{module.name}</span>
                                            </div>
                                            <span className={`ms-auto transition-all ${isExpanded ? 'rotate-90' : ''}`} style={{ fontSize: '0.6rem', opacity: isExpanded ? 0.8 : 0.3 }}>
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="mt-2 ms-2 ps-3 border-start border-primary border-opacity-10 fade-in" style={{ borderColor: 'hsla(var(--primary), 0.2) !important' }}>
                                                <ul className="list-unstyled fw-normal pb-1 small mt-1">
                                                    {canView && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/records`}
                                                                className={({ isActive }) => `text-decoration-none d-flex align-items-center py-2 px-3 rounded-pill transition-all mb-1 ${isActive ? 'menu-active scale-105' : 'text-nav hover-bg-theme fw-medium'}`}
                                                            >
                                                                <span className="me-2" style={{ width: '20px' }}>📋</span>
                                                                {t('records')}
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canManage && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/fields`}
                                                                className={({ isActive }) => `text-decoration-none d-flex align-items-center py-2 px-3 rounded-pill transition-all mb-1 ${isActive ? 'menu-active scale-105' : 'text-nav hover-bg-theme fw-medium'}`}
                                                            >
                                                                <span className="me-2" style={{ width: '20px' }}>⚙️</span>
                                                                {t('fields')}
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canApi && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/api-configs`}
                                                                className={({ isActive }) => `text-decoration-none d-flex align-items-center py-2 px-3 rounded-pill transition-all mb-1 ${isActive ? 'menu-active scale-105' : 'text-nav hover-bg-theme fw-medium'}`}
                                                            >
                                                                <span className="me-2" style={{ width: '20px' }}>🔌</span>
                                                                API
                                                            </NavLink>
                                                        </li>
                                                    )}
                                                    {canScript && (
                                                        <li>
                                                            <NavLink
                                                                to={`/modules/${module.id}/scripts`}
                                                                className={({ isActive }) => `text-decoration-none d-flex align-items-center py-2 px-3 rounded-pill transition-all mb-1 ${isActive ? 'menu-active scale-105' : 'text-nav hover-bg-theme fw-medium'}`}
                                                            >
                                                                <span className="me-2" style={{ width: '20px' }}>📜</span>
                                                                Scripts
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
