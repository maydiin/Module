using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Module.Authorization;

public class PermissionPolicyProvider : DefaultAuthorizationPolicyProvider
{
    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : base(options)
    {
    }

    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        var policy = await base.GetPolicyAsync(policyName);

        if (policy == null)
        {
            // Check if this is a module-specific permission policy
            if (policyName.StartsWith("ModulePermission:"))
            {
                var action = policyName.Replace("ModulePermission:", "");
                policy = new AuthorizationPolicyBuilder()
                    .AddRequirements(new ModulePermissionRequirement(action))
                    .Build();
            }
            else
            {
                // Regular permission policy
                policy = new AuthorizationPolicyBuilder()
                    .AddRequirements(new PermissionRequirement(policyName))
                    .Build();
            }
        }

        return policy;
    }
}
