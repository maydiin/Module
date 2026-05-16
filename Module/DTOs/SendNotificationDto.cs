using Module.Entities;

namespace Module.DTOs
{
    public class SendNotificationDto
    {
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public NotificationType Type { get; set; } = NotificationType.Info;
        public string? ActionUrl { get; set; }
        public string TargetType { get; set; } = "All"; // All, Users, Roles
        public List<int>? UserIds { get; set; }
        public List<int>? RoleIds { get; set; }
    }
}
