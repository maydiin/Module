using Microsoft.EntityFrameworkCore;
using Module.Entities;
using System.Text.Json;
using ModuleEntity = Module.Entities.Module;

namespace Module.Data;

public static class SeedData
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Seed Permissions
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

        // 2. Seed Roles
        var rolesToSeed = new List<Role>
        {
            new Role { Name = "Admin", Description = "Full system access" },
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

        // 3. Ensure Admin has all permissions
        var adminRole = await context.Roles.Include(r => r.RolePermissions).FirstOrDefaultAsync(r => r.Name == "Admin");
        if (adminRole != null)
        {
            var allPermissions = await context.Permissions.ToListAsync();
            foreach (var perm in allPermissions)
            {
                if (!adminRole.RolePermissions.Any(rp => rp.PermissionId == perm.Id))
                {
                    context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = perm.Id });
                }
            }
        }

        // 4. Seeding permissions for default roles (Viewer, etc.) will be handled after modules are seeded.
        await context.SaveChangesAsync();

        // 5. Seed Admin User
        if (!await context.Users.AnyAsync(u => u.Username == "admin"))
        {
            var adminUser = new User 
            { 
                Username = "admin", 
                Email = "admin@example.com", 
                PasswordHash = "admin123" 
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();
            
            if (adminRole != null)
            {
                context.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = adminRole.Id });
            }
        }
        else
        {
            // Ensure existing admin user has Admin role
            var adminUser = await context.Users.Include(u => u.UserRoles).FirstAsync(u => u.Username == "admin");
            if (adminRole != null && !adminUser.UserRoles.Any(ur => ur.RoleId == adminRole.Id))
            {
                context.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = adminRole.Id });
            }
        }
        await context.SaveChangesAsync();
    }
}

