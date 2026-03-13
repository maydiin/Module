using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;
    private readonly IAuditLogService _auditLogService;

    public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService, IAuditLogService auditLogService)
    {
        _context = context;
        _configuration = configuration;
        _emailService = emailService;
        _auditLogService = auditLogService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Username == dto.Username);

        if (user == null || user.PasswordHash != dto.Password) // Simplified for demo, should use BCrypt/Argon2
        {
            return Unauthorized(new { error = "Invalid username or password" });
        }

        if (!user.IsEmailVerified)
        {
            return Unauthorized(new { error = "E-posta adresiniz doğrulanmamış. Lütfen e-postanıza gelen doğrulama kodunu kullanın." });
        }

        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtSettings = _configuration.GetSection("Jwt");
        var key = Encoding.ASCII.GetBytes(jwtSettings["Key"] ?? "super_secret_key_that_is_at_least_32_characters");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("TenantId", user.TenantId.ToString())
        };

        foreach (var userRole in user.UserRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, userRole.Role.Name));
        }
        
        // Add IsSuperAdmin claim
        var isSuperAdmin = user.UserRoles.Any(ur => ur.Role.Name == "Super Admin");
        claims.Add(new Claim("IsSuperAdmin", isSuperAdmin.ToString()));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var permissions = user.UserRoles
            .Select(ur => ur.Role)
            .SelectMany(r => r.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToList();

        await _auditLogService.LogAsync("Login", "Auth", user.Id.ToString(), user.Username);

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true, // Should be true in production
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7)
        };
        Response.Cookies.Append("token", tokenString, cookieOptions);

        return Ok(new
        {
            username = user.Username,
            permissions = permissions,
            isSuperAdmin = isSuperAdmin
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterDto dto)
    {
        // Check if username already exists
        if (await _context.Users.AnyAsync(u => u.Username == dto.Username))
        {
            return BadRequest(new { error = "Bu kullanıcı adı zaten kullanılıyor" });
        }

        // Check if email already exists
        if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
        {
            return BadRequest(new { error = "Bu e-posta adresi zaten kullanılıyor" });
        }

        // Generate 6-digit verification code
        var verificationCode = new Random().Next(100000, 999999).ToString();

        // Create new user (without tenant initially)
        var user = new User
        {
            Username = dto.Username,
            Email = dto.Email,
            PasswordHash = dto.Password, // Simplified for demo, should use BCrypt/Argon2
            EmailVerificationCode = verificationCode,
            EmailVerificationCodeExpiry = DateTime.UtcNow.AddMinutes(15),
            IsEmailVerified = false,
            TenantId = null // Will be set after email verification
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Send verification email
        try
        {
            await _emailService.SendVerificationEmailAsync(user.Email, user.Username, verificationCode);
        }
        catch (Exception ex)
        {
            // Log error but don't fail the registration
            Console.WriteLine($"Failed to send verification email: {ex.Message}");
        }

        await _auditLogService.LogAsync("Register", "Auth", user.Id.ToString(), user.Username);

        return Ok(new { message = "Kayıt başarılı! E-posta adresinize gönderilen doğrulama kodunu kullanarak hesabınızı aktif edin.", email = user.Email });
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user == null)
        {
            return BadRequest(new { error = "Kullanıcı bulunamadı" });
        }

        if (user.IsEmailVerified)
        {
            return BadRequest(new { error = "E-posta adresi zaten doğrulanmış" });
        }

        if (user.EmailVerificationCode != dto.VerificationCode)
        {
            return BadRequest(new { error = "Geçersiz doğrulama kodu" });
        }

        if (user.EmailVerificationCodeExpiry == null || user.EmailVerificationCodeExpiry < DateTime.UtcNow)
        {
            return BadRequest(new { error = "Doğrulama kodunun süresi dolmuş. Lütfen yeni bir kod isteyin." });
        }

        // Verify the email
        user.IsEmailVerified = true;
        user.EmailVerificationCode = null;
        user.EmailVerificationCodeExpiry = null;
        
        // Create tenant for the user
        var newTenant = new Tenant
        {
            Name = $"{user.Username}_Tenant",
            IsHost = false,
            Subdomain = user.Username.ToLower()
        };
        _context.Tenants.Add(newTenant);
        await _context.SaveChangesAsync();
        
        // Assign user to the new tenant
        user.TenantId = newTenant.Id;
        
        // Create default permissions for the new tenant
        var defaultPermissions = new List<Permission>
        {
            new Permission { Name = "User.Manage", Description = "Can manage users and roles", TenantId = newTenant.Id },
            new Permission { Name = "Role.Manage", Description = "Can manage roles and permissions", TenantId = newTenant.Id },
            new Permission { Name = "AuditLog.View", Description = "Can view audit logs", TenantId = newTenant.Id }
        };
        _context.Permissions.AddRange(defaultPermissions);
        await _context.SaveChangesAsync();
        
        // Create default roles for the new tenant
        var adminRole = new Role { Name = "Admin", Description = "Full access within tenant", TenantId = newTenant.Id };
        var viewerRole = new Role { Name = "Viewer", Description = "Read-only access", TenantId = newTenant.Id };
        _context.Roles.AddRange(adminRole, viewerRole);
        await _context.SaveChangesAsync();
        
        // Assign all permissions to Admin role
        foreach (var perm in defaultPermissions)
        {
            _context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = perm.Id });
        }
        
        // Assign Admin role to the user
        _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = adminRole.Id });

        await _context.SaveChangesAsync();

        return Ok(new { message = "E-posta adresiniz başarıyla doğrulandı! Artık giriş yapabilirsiniz." });
    }

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

        if (user == null)
        {
            return BadRequest(new { error = "Kullanıcı bulunamadı" });
        }

        if (user.IsEmailVerified)
        {
            return BadRequest(new { error = "E-posta adresi zaten doğrulanmış" });
        }

        // Generate new verification code
        var verificationCode = new Random().Next(100000, 999999).ToString();
        user.EmailVerificationCode = verificationCode;
        user.EmailVerificationCodeExpiry = DateTime.UtcNow.AddMinutes(15);

        await _context.SaveChangesAsync();

        // Send verification email — exceptions bubble up to ExceptionHandlingMiddleware
        await _emailService.SendVerificationEmailAsync(user.Email, user.Username, verificationCode);

        return Ok(new { message = "Yeni doğrulama kodu e-posta adresinize gönderildi" });
    }

    [HttpPost("seed")]
    public async Task<IActionResult> Seed()
    {
        await SeedData.SeedAsync(_context);
        return Ok(new { message = "System seeded successfully. Default User: admin / Password: admin123" });
    }

    [HttpPost("refresh-token")]
    [Authorize]
    public async Task<IActionResult> RefreshToken()
    {
        // Get current user ID from claims
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { error = "Invalid token" });
        }

        // Fetch user with current roles and permissions
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return Unauthorized(new { error = "User not found" });
        }

        // Generate new token with updated roles and permissions
        var tokenHandler = new JwtSecurityTokenHandler();
        var jwtSettings = _configuration.GetSection("Jwt");
        var key = Encoding.ASCII.GetBytes(jwtSettings["Key"] ?? "super_secret_key_that_is_at_least_32_characters");

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim("TenantId", user.TenantId?.ToString() ?? "")
        };

        foreach (var userRole in user.UserRoles)
        {
            claims.Add(new Claim(ClaimTypes.Role, userRole.Role.Name));
        }
        
        // Add IsSuperAdmin claim
        var isSuperAdmin = user.UserRoles.Any(ur => ur.Role.Name == "Super Admin");
        claims.Add(new Claim("IsSuperAdmin", isSuperAdmin.ToString()));

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        var permissions = user.UserRoles
            .Select(ur => ur.Role)
            .SelectMany(r => r.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToList();

        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7)
        };
        Response.Cookies.Append("token", tokenString, cookieOptions);

        return Ok(new
        {
            username = user.Username,
            permissions = permissions,
            isSuperAdmin = isSuperAdmin
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return Unauthorized();
        }

        var permissions = user.UserRoles
            .Select(ur => ur.Role)
            .SelectMany(r => r.RolePermissions)
            .Select(rp => rp.Permission.Name)
            .Distinct()
            .ToList();

        var isSuperAdmin = user.UserRoles.Any(ur => ur.Role.Name == "Super Admin");

        return Ok(new
        {
            username = user.Username,
            permissions = permissions,
            isSuperAdmin = isSuperAdmin,
            tenantId = user.TenantId
        });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("token");
        return Ok(new { message = "Logged out successfully" });
    }
}

public class LoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
