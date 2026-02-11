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

        // 2. Seed Permissions
        var permissionsToSeed = new List<Permission>
        {
            new Permission { Name = "User.Manage", Description = "Can manage users and roles" },
            new Permission { Name = "Role.Manage", Description = "Can manage roles and permissions" }
        };

        foreach (var perm in permissionsToSeed)
        {
            if (!await context.Permissions.AnyAsync(p => p.Name == perm.Name))
            {
                context.Permissions.Add(perm);
            }
        }
        await context.SaveChangesAsync();

        // 3. Seed Roles
        var rolesToSeed = new List<Role>
        {
            new Role { Name = "Super Admin", Description = "Full system access across all tenants" },
            new Role { Name = "Admin", Description = "Full access within tenant" },
            new Role { Name = "Viewer", Description = "Read-only access" }
        };

        foreach (var role in rolesToSeed)
        {
            if (!await context.Roles.AnyAsync(r => r.Name == role.Name))
            {
                context.Roles.Add(role);
            }
        }
        await context.SaveChangesAsync();

        // 4. Ensure Super Admin and Admin have all permissions
        var superAdminRole = await context.Roles.Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Name == "Super Admin");
        var adminRole = await context.Roles.Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Name == "Admin");
        
        if (superAdminRole != null || adminRole != null)
        {
            var allPermissions = await context.Permissions.ToListAsync();
            
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
        if (!await context.Users.AnyAsync(u => u.Username == "admin"))
        {
            var adminUser = new User 
            { 
                Username = "admin", 
                Email = "admin@example.com", 
                PasswordHash = "admin123",
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
            var adminUser = await context.Users.Include(u => u.UserRoles).FirstAsync(u => u.Username == "admin");
            
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
    }
}

