using System;

namespace Module.Entities
{
    public enum NotificationType
    {
        Info,
        Success,
        Warning,
        Error
    }

    public class Notification
    {
        public int Id { get; set; }
        
        // Target User (null if broadcast/system-wide)
        public int? UserId { get; set; }
        public User? User { get; set; }
        
        // Multi-tenant support
        public int? TenantId { get; set; }
        public Tenant? Tenant { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public NotificationType Type { get; set; } = NotificationType.Info;
        
        public bool IsRead { get; set; } = false;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Optional link/action metadata
        public string? ActionUrl { get; set; }
        public string? ActionData { get; set; } // JSON metadata for frontend if needed
    }
}
