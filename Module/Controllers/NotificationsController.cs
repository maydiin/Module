using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Module.DTOs;
using Module.Services;

namespace Module.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _notificationService;

        public NotificationsController(INotificationService notificationService)
        {
            _notificationService = notificationService;
        }
        
        [HttpPost("send")]
        [Authorization.HasPermission("Notification.Send")]
        public async Task<IActionResult> SendNotification([FromBody] SendNotificationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
            {
                return BadRequest(ApiResponse<object>.Fail("Title and Message are required."));
            }

            switch (dto.TargetType)
            {
                case "All":
                    await _notificationService.BroadcastAsync(dto.Title, dto.Message, dto.Type, dto.ActionUrl);
                    break;
                case "Users":
                    if (dto.UserIds == null || !dto.UserIds.Any())
                        return BadRequest(ApiResponse<object>.Fail("UserIds are required for TargetType 'Users'."));
                    await _notificationService.SendToUsersAsync(dto.UserIds, dto.Title, dto.Message, dto.Type, dto.ActionUrl);
                    break;
                case "Roles":
                    if (dto.RoleIds == null || !dto.RoleIds.Any())
                        return BadRequest(ApiResponse<object>.Fail("RoleIds are required for TargetType 'Roles'."));
                    await _notificationService.SendToRolesAsync(dto.RoleIds, dto.Title, dto.Message, dto.Type, dto.ActionUrl);
                    break;
                default:
                    return BadRequest(ApiResponse<object>.Fail("Invalid TargetType."));
            }

            return Ok(ApiResponse<object>.Ok(new { }, "Notification sent successfully."));
        }

        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] int limit = 50)
        {
            var userId = GetCurrentUserId();
            var notifications = await _notificationService.GetUserNotificationsAsync(userId, limit);
            return Ok(ApiResponse<object>.Ok(notifications));
        }

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var userId = GetCurrentUserId();
            var count = await _notificationService.GetUnreadCountAsync(userId);
            return Ok(ApiResponse<int>.Ok(count));
        }

        [HttpPut("{id}/read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            var userId = GetCurrentUserId();
            await _notificationService.MarkAsReadAsync(id, userId);
            return Ok(ApiResponse<object>.Ok(null));
        }

        [HttpPut("read-all")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            var userId = GetCurrentUserId();
            await _notificationService.MarkAllAsReadAsync(userId);
            return Ok(ApiResponse<object>.Ok(null));
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out int id) ? id : 0;
        }
    }
}
