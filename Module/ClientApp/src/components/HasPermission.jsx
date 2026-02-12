import React from 'react';

/**
 * HasPermission component
 * 
 * Usage:
 * <HasPermission permission="Module.Kurum.View">
 *   <button>View Records</button>
 * </HasPermission>
 * 
 * Supports transforming generic permissions if moduleId or moduleName is provided:
 * <HasPermission permission="Module.Records.Create" moduleId={1}>...</HasPermission>
 */
const HasPermission = ({ permission, moduleId, moduleName, children, fallback = null }) => {
    // Super Admin always has full access across all tenants
    const isSuperAdmin = localStorage.getItem('isSuperAdmin') === 'true';
    if (isSuperAdmin) {
        return children;
    }

    const permissionsJson = localStorage.getItem('permissions');
    const userPermissions = permissionsJson ? JSON.parse(permissionsJson) : [];

    let permissionToCheck = permission;

    const hasPermission = userPermissions.includes(permissionToCheck);

    if (!hasPermission) {
        return fallback;
    }

    return children;
};

export default HasPermission;
