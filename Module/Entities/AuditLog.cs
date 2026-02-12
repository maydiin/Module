namespace Module.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty; // Create, Update, Delete, Login, Register
    public string EntityType { get; set; } = string.Empty; // Module, Record, Field, Role, User, Auth
    public string? EntityId { get; set; }
    public string? EntityName { get; set; }
    public int? UserId { get; set; }
    public string? Username { get; set; }
    public int TenantId { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? Details { get; set; } // JSON for extra info (old/new values, etc.)
    public string? IpAddress { get; set; }
}
