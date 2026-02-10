using Microsoft.AspNetCore.Authorization;

namespace Module.Authorization;

/// <summary>
/// Attribute for module-specific permissions.
/// Requires moduleId or moduleName in route to resolve Module.{ModuleName}.{Action}.
/// The actual module name resolution happens at request time via custom logic.
/// </summary>
public class HasModulePermissionAttribute : AuthorizeAttribute
{
    public HasModulePermissionAttribute(string action)
    {
        // Store the action for later resolution
        // We'll need a custom policy handler to resolve this at runtime
        Policy = $"ModulePermission:{action}";
    }
}
