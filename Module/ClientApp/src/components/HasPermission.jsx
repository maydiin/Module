import React from 'react';
import { useAuth } from './AuthContext';

/**
 * HasPermission component
 */
const HasPermission = ({ permission, permissions, children, fallback = null }) => {
    const { hasPermission: checkPermission, isSuperAdmin } = useAuth();
    
    if (isSuperAdmin) {
        return children;
    }

    const hasAccess =
        (permissions && Array.isArray(permissions) && permissions.some(p => checkPermission(p))) ||
        (permission && checkPermission(permission));

    if (!hasAccess) {
        return fallback;
    }

    return children;
};

export default HasPermission;
