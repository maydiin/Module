using Module.Entities;

namespace Module.Services
{
    public interface INotificationService
    {
        Task SendToUserAsync(int userId, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null);
        Task BroadcastAsync(string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null);
        Task SendToTenantAsync(int tenantId, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null);
        Task<List<Notification>> GetUserNotificationsAsync(int userId, int limit = 50);
        Task<int> GetUnreadCountAsync(int userId);
        Task MarkAsReadAsync(int notificationId, int userId);
        Task MarkAllAsReadAsync(int userId);
    }
}
