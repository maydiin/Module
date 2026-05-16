using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Hubs;

namespace Module.Services
{
    public class NotificationService : INotificationService
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<NotificationHub> _hubContext;

        public NotificationService(AppDbContext context, IHubContext<NotificationHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        public async Task SendToUserAsync(int userId, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null)
        {
            var notification = new Notification
            {
                UserId = userId,
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            // Real-time delivery
            await _hubContext.Clients.User(userId.ToString()).SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.ActionUrl,
                notification.CreatedAt,
                notification.IsRead
            });
        }

        public async Task SendToUsersAsync(List<int> userIds, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null)
        {
            foreach (var userId in userIds)
            {
                await SendToUserAsync(userId, title, message, type, actionUrl);
            }
        }

        public async Task SendToRolesAsync(List<int> roleIds, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null)
        {
            var userIds = await _context.UserRoles
                .Where(ur => roleIds.Contains(ur.RoleId))
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync();

            await SendToUsersAsync(userIds, title, message, type, actionUrl);
        }

        public async Task BroadcastAsync(string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null)
        {
            var notification = new Notification
            {
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            // Real-time delivery to everyone
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.ActionUrl,
                notification.CreatedAt,
                notification.IsRead
            });
        }

        public async Task SendToTenantAsync(int tenantId, string title, string message, NotificationType type = NotificationType.Info, string? actionUrl = null)
        {
            // For tenant-wide, we might want to store one notification per user or a single tenant notification
            // Here we'll store a single notification with TenantId set
            var notification = new Notification
            {
                TenantId = tenantId,
                Title = title,
                Message = message,
                Type = type,
                ActionUrl = actionUrl,
                CreatedAt = DateTime.UtcNow,
                IsRead = false
            };

            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync();

            // SignalR doesn't have a built-in "Group" for tenants unless we add users to groups
            // For now, let's just broadcast or we could implement tenant groups in the Hub
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", new
            {
                notification.Id,
                notification.Title,
                notification.Message,
                notification.Type,
                notification.ActionUrl,
                notification.CreatedAt,
                notification.IsRead,
                notification.TenantId
            });
        }

        public async Task<List<Notification>> GetUserNotificationsAsync(int userId, int limit = 50)
        {
            return await _context.Notifications
                .Where(n => n.UserId == userId || n.UserId == null)
                .OrderByDescending(n => n.CreatedAt)
                .Take(limit)
                .ToListAsync();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            return await _context.Notifications
                .CountAsync(n => (n.UserId == userId || n.UserId == null) && !n.IsRead);
        }

        public async Task MarkAsReadAsync(int notificationId, int userId)
        {
            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == notificationId && (n.UserId == userId || n.UserId == null));

            if (notification != null)
            {
                notification.IsRead = true;
                await _context.SaveChangesAsync();
            }
        }

        public async Task MarkAllAsReadAsync(int userId)
        {
            var notifications = await _context.Notifications
                .Where(n => (n.UserId == userId || n.UserId == null) && !n.IsRead)
                .ToListAsync();

            foreach (var n in notifications)
            {
                n.IsRead = true;
            }

            await _context.SaveChangesAsync();
        }
    }
}
