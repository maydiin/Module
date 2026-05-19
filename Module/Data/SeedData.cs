using Microsoft.EntityFrameworkCore;
using Module.Entities;
using System.Text.Json;
using ModuleEntity = Module.Entities.Module;

namespace Module.Data;

public static class SeedData
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Seed Host Tenant
        var hostTenant = await context.Tenants.FirstOrDefaultAsync(t => t.IsHost);
        if (hostTenant == null)
        {
            hostTenant = new Tenant
            {
                Name = "Host",
                IsHost = true,
                Subdomain = "host"
            };
            context.Tenants.Add(hostTenant);
            await context.SaveChangesAsync();
        }

        // 2. Seed Permissions (for Host tenant)
        var permissionsToSeed = new List<Permission>
        {
            new Permission { Name = "User.Manage", Description = "Can manage users and roles", TenantId = hostTenant.Id },
            new Permission { Name = "Role.Manage", Description = "Can manage roles and permissions", TenantId = hostTenant.Id },
            new Permission { Name = "AuditLog.View", Description = "Can view audit logs", TenantId = hostTenant.Id },
            new Permission { Name = "Notification.Send", Description = "Can send manual notifications", TenantId = hostTenant.Id }
        };

        foreach (var perm in permissionsToSeed)
        {
            if (!await context.Permissions.IgnoreQueryFilters().AnyAsync(p => p.Name == perm.Name && p.TenantId == hostTenant.Id))
            {
                context.Permissions.Add(perm);
            }
        }
        await context.SaveChangesAsync();

        // 3. Seed Roles (for Host tenant)
        var rolesToSeed = new List<Role>
        {
            new Role { Name = "Super Admin", Description = "Full system access across all tenants", TenantId = hostTenant.Id },
            new Role { Name = "Admin", Description = "Full access within tenant", TenantId = hostTenant.Id },
            new Role { Name = "Viewer", Description = "Read-only access", TenantId = hostTenant.Id }
        };

        foreach (var role in rolesToSeed)
        {
            if (!await context.Roles.IgnoreQueryFilters().AnyAsync(r => r.Name == role.Name && r.TenantId == hostTenant.Id))
            {
                context.Roles.Add(role);
            }
        }
        await context.SaveChangesAsync();

        // 3.5 Fix existing roles/permissions with null TenantId (migration fix)
        var rolesWithNullTenant = await context.Roles.IgnoreQueryFilters().Where(r => r.TenantId == null).ToListAsync();
        foreach (var role in rolesWithNullTenant)
        {
            var existing = await context.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Name == role.Name && r.TenantId == hostTenant.Id);
            if (existing != null)
            {
                var userRoles = await context.UserRoles.IgnoreQueryFilters().Where(ur => ur.RoleId == role.Id).ToListAsync();
                foreach (var ur in userRoles)
                {
                    if (!await context.UserRoles.IgnoreQueryFilters().AnyAsync(x => x.UserId == ur.UserId && x.RoleId == existing.Id))
                    {
                        ur.RoleId = existing.Id;
                    }
                    else
                    {
                        context.UserRoles.Remove(ur);
                    }
                }
                var rolePerms = await context.RolePermissions.IgnoreQueryFilters().Where(rp => rp.RoleId == role.Id).ToListAsync();
                foreach (var rp in rolePerms)
                {
                    if (!await context.RolePermissions.IgnoreQueryFilters().AnyAsync(x => x.PermissionId == rp.PermissionId && x.RoleId == existing.Id))
                    {
                        rp.RoleId = existing.Id;
                    }
                    else
                    {
                        context.RolePermissions.Remove(rp);
                    }
                }
                context.Roles.Remove(role);
            }
            else
            {
                role.TenantId = hostTenant.Id;
            }
        }
        await context.SaveChangesAsync();

        var permsWithNullTenant = await context.Permissions.IgnoreQueryFilters().Where(p => p.TenantId == null).ToListAsync();
        foreach (var perm in permsWithNullTenant)
        {
            var existing = await context.Permissions.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Name == perm.Name && p.TenantId == hostTenant.Id);
            if (existing != null)
            {
                var rolePerms = await context.RolePermissions.IgnoreQueryFilters().Where(rp => rp.PermissionId == perm.Id).ToListAsync();
                foreach (var rp in rolePerms)
                {
                    if (!await context.RolePermissions.IgnoreQueryFilters().AnyAsync(x => x.RoleId == rp.RoleId && x.PermissionId == existing.Id))
                    {
                        rp.PermissionId = existing.Id;
                    }
                    else
                    {
                        context.RolePermissions.Remove(rp);
                    }
                }
                context.Permissions.Remove(perm);
            }
            else
            {
                perm.TenantId = hostTenant.Id;
            }
        }
        await context.SaveChangesAsync();

        // 4. Ensure Super Admin and Admin have all host tenant permissions
        var superAdminRole = await context.Roles.IgnoreQueryFilters().Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Name == "Super Admin" && r.TenantId == hostTenant.Id);
        var adminRole = await context.Roles.IgnoreQueryFilters().Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == hostTenant.Id);
        
        if (superAdminRole != null || adminRole != null)
        {
            var allPermissions = await context.Permissions.IgnoreQueryFilters().Where(p => p.TenantId == hostTenant.Id).ToListAsync();
            
            // Assign all permissions to Super Admin
            if (superAdminRole != null)
            {
                foreach (var perm in allPermissions)
                {
                    if (!superAdminRole.RolePermissions.Any(rp => rp.PermissionId == perm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = superAdminRole.Id, PermissionId = perm.Id });
                    }
                }
            }
            
            // Assign all permissions to Admin
            if (adminRole != null)
            {
                foreach (var perm in allPermissions)
                {
                    if (!adminRole.RolePermissions.Any(rp => rp.PermissionId == perm.Id))
                    {
                        context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = perm.Id });
                    }
                }
            }
        }

        await context.SaveChangesAsync();

        // 5. Seed Admin User in Host Tenant
        if (!await context.Users.IgnoreQueryFilters().AnyAsync(u => u.Username == "admin"))
        {
            var adminUser = new User 
            { 
                Username = "admin", 
                Email = "admin@example.com", 
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                TenantId = hostTenant.Id,
                IsEmailVerified = true // Admin doesn't need email verification
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
            
            if (superAdminRole != null)
            {
                context.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = superAdminRole.Id });
            }
        }
        else
        {
            // Ensure existing admin user is in Host tenant and has Super Admin role
            var adminUser = await context.Users.IgnoreQueryFilters().Include(u => u.UserRoles).FirstAsync(u => u.Username == "admin");
            
            // Update tenant if not set
            if (adminUser.TenantId == null)
            {
                adminUser.TenantId = hostTenant.Id;
                adminUser.IsEmailVerified = true;
            }
            
            // Assign Super Admin role if not already assigned
            if (superAdminRole != null && !adminUser.UserRoles.Any(ur => ur.RoleId == superAdminRole.Id))
            {
                context.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = superAdminRole.Id });
            }
        }
        await context.SaveChangesAsync();

        // 6. Backfill "Api" permission for existing modules
        var allModules = await context.Modules.IgnoreQueryFilters().ToListAsync();
        foreach (var module in allModules)
        {
            var apiPermName = $"Module.{module.Name}.Api";
            if (!await context.Permissions.IgnoreQueryFilters().AnyAsync(p => p.Name == apiPermName && p.TenantId == module.TenantId))
            {
                var apiPerm = new Permission
                {
                    Name = apiPermName,
                    Description = $"Can manage {module.Name} API integrations",
                    TenantId = module.TenantId
                };
                context.Permissions.Add(apiPerm);
                await context.SaveChangesAsync(); // Save to get Id

                // Assign to Admin role of that tenant
                var adminRoleForTenant = await context.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == module.TenantId);
                if (adminRoleForTenant != null)
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = adminRoleForTenant.Id, PermissionId = apiPerm.Id });
                }
            }
        }
        await context.SaveChangesAsync();

        // 7. Backfill "Script" permission for existing modules
        foreach (var module in allModules)
        {
            var scriptPermName = $"Module.{module.Name}.Script";
            if (!await context.Permissions.IgnoreQueryFilters().AnyAsync(p => p.Name == scriptPermName && p.TenantId == module.TenantId))
            {
                var scriptPerm = new Permission
                {
                    Name = scriptPermName,
                    Description = $"Can manage {module.Name} dynamic scripts",
                    TenantId = module.TenantId
                };
                context.Permissions.Add(scriptPerm);
                await context.SaveChangesAsync(); 

                // Assign to Admin role of that tenant
                var adminRoleForTenant = await context.Roles.IgnoreQueryFilters().FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == module.TenantId);
                if (adminRoleForTenant != null)
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = adminRoleForTenant.Id, PermissionId = scriptPerm.Id });
                }
            }
        }
        await context.SaveChangesAsync();
    }
}
