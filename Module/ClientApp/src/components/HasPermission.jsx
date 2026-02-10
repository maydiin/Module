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
    const permissionsJson = localStorage.getItem('permissions');
    const userPermissions = permissionsJson ? JSON.parse(permissionsJson) : [];

    // Check if user is admin (optional: depends on if "Admin" is a permission or just a role)
    // For this system, Admin role simply has all permissions, so check permission names directly.

    let permissionToCheck = permission;

    // Direct module-specific permissions are used (e.g., Module.Kurum.View)
    // No generic Module.Records.* permissions

    const hasPermission = userPermissions.includes(permissionToCheck);

    if (!hasPermission) {
        return fallback;
    }

    return children;
};

export default HasPermission;
