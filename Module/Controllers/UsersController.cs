using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Authorization;
using Module.Data;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/users")]
[Authorize]
[HasPermission("User.Manage")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;

    public UsersController(AppDbContext context, ITenantService tenantService, IAuditLogService auditLogService)
    {
        _context = context;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var users = await _context.Users
            .Where(u => u.TenantId == tenantId)
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Select(u => new {
                u.Id,
                u.Username,
                u.Email,
                u.CreatedAt,
                Roles = u.UserRoles.Select(ur => ur.Role.Name)
            })
            .ToListAsync();
        return Ok(users);
    }

    [HttpPost("{userId}/roles")]
    public async Task<IActionResult> AssignRole(int userId, [FromBody] RoleAssignmentDto dto)
    {
        var user = await _context.Users.Include(u => u.UserRoles).FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null) return NotFound();

        var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == dto.RoleName);
        if (role == null) return BadRequest(new { error = "Role not found" });

        if (user.UserRoles.Any(ur => ur.RoleId == role.Id)) return BadRequest(new { error = "User already has this role" });

        _context.UserRoles.Add(new UserRole { UserId = userId, RoleId = role.Id });
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync("Update", "User", userId.ToString(), user.Username, $"Role assigned: {dto.RoleName}");
        
        // Check if the role was assigned to the current user
        var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var shouldRefresh = userId == currentUserId;
        
        return Ok(new { shouldRefreshToken = shouldRefresh });
    }

    [HttpDelete("{userId}/roles/{roleName}")]
    public async Task<IActionResult> RemoveRole(int userId, string roleName)
    {
        var userRole = await _context.UserRoles
            .Include(ur => ur.Role)
            .FirstOrDefaultAsync(ur => ur.UserId == userId && ur.Role.Name == roleName);
            
        if (userRole == null) return NotFound();

        _context.UserRoles.Remove(userRole);
        await _context.SaveChangesAsync();

        await _auditLogService.LogAsync("Update", "User", userId.ToString(), null, $"Role removed: {roleName}");
        
        // Check if the role was removed from the current user
        var currentUserId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        var shouldRefresh = userId == currentUserId;
        
        return Ok(new { shouldRefreshToken = shouldRefresh });
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] Module.DTOs.CreateUserDto dto)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        if (tenantId == 0) return BadRequest(new { error = "Tenant context required" });

        // Check if username exists
        if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest(new { error = "Username already exists" });

        // Check if email exists
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
            return BadRequest(new { error = "Email already exists" });

        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = dto.Password, // TODO: Hash password
            IsEmailVerified = true, // Admin created users are verified
            TenantId = tenantId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Assign roles
        if (dto.Roles != null && dto.Roles.Any())
        {
            var validRoles = await _context.Roles
                .Where(r => r.TenantId == tenantId && dto.Roles.Contains(r.Name))
                .ToListAsync();

            foreach (var role in validRoles)
            {
                _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
            }
            await _context.SaveChangesAsync();
        }

        await _auditLogService.LogAsync("Create", "User", user.Id.ToString(), user.Username, $"User created by admin");

        return Ok(new { message = "User created successfully", userId = user.Id });
    }
}

public class RoleAssignmentDto
{
    public string RoleName { get; set; } = string.Empty;
}
