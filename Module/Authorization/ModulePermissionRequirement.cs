using Microsoft.AspNetCore.Authorization;

namespace Module.Authorization;

/// <summary>
/// Requirement for module-specific permissions.
/// </summary>
public class ModulePermissionRequirement : IAuthorizationRequirement
{
    public string Action { get; }

    public ModulePermissionRequirement(string action)
    {
        Action = action;
    }
}
