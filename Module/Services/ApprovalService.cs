using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;

namespace Module.Services;

public class ApprovalService : IApprovalService
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly INotificationService _notificationService;
    private readonly ILogger<ApprovalService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public ApprovalService(
        AppDbContext context, 
        ITenantService tenantService, 
        INotificationService notificationService,
        ILogger<ApprovalService> logger,
        IHttpContextAccessor httpContextAccessor)
    {
        _context = context;
        _tenantService = tenantService;
        _notificationService = notificationService;
        _logger = logger;
        _httpContextAccessor = httpContextAccessor;
    }

    private int GetCurrentUserId()
    {
        var userIdStr = _httpContextAccessor.HttpContext?.User?.Claims?.FirstOrDefault(c => c.Type == "id")?.Value;
        if (int.TryParse(userIdStr, out int userId)) return userId;
        return 0; // System action if no user
    }

    public async Task RequestApprovalAsync(int moduleId, int moduleRecordId, string? roleName, string? message)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var record = await _context.ModuleRecords
            .FirstOrDefaultAsync(r => r.Id == moduleRecordId && r.ModuleId == moduleId && r.TenantId == tenantId);
            
        if (record == null) throw new KeyNotFoundException("Record not found.");

        int? assignedRoleId = null;
        if (!string.IsNullOrEmpty(roleName))
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == roleName && r.TenantId == tenantId);
            if (role != null) assignedRoleId = role.Id;
        }

        var approvalRequest = new ApprovalRequest
        {
            ModuleId = moduleId,
            ModuleRecordId = moduleRecordId,
            RequestedByUserId = GetCurrentUserId(),
            AssignedToRoleId = assignedRoleId,
            Status = "Pending",
            Message = message,
            TenantId = tenantId
        };

        record.ApprovalStatus = "Pending";

        _context.ApprovalRequests.Add(approvalRequest);
        await _context.SaveChangesAsync();

        // Send notification to role
        if (assignedRoleId.HasValue)
        {
            var module = await _context.Modules.FindAsync(moduleId);
            await _notificationService.SendToRolesAsync(
                new List<int> { assignedRoleId.Value },
                "Onay Bekliyor",
                $"{module?.Name} modülünde onayınızı bekleyen yeni bir kayıt var: {message}",
                NotificationType.Warning,
                $"/modules/{moduleId}/records/{moduleRecordId}"
            );
        }
    }

    public async Task ApproveRecordAsync(int moduleId, int recordId, int userId)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var request = await _context.ApprovalRequests
            .Where(a => a.ModuleId == moduleId && a.ModuleRecordId == recordId && a.TenantId == tenantId && a.Status == "Pending")
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (request == null) throw new InvalidOperationException("No pending approval found for this record.");

        request.Status = "Approved";
        request.ResolvedAt = DateTime.UtcNow;
        request.ResolvedByUserId = userId;

        var record = await _context.ModuleRecords.FindAsync(recordId);
        if (record != null) record.ApprovalStatus = "Approved";

        await _context.SaveChangesAsync();
        
        // Notification to requester
        var module = await _context.Modules.FindAsync(moduleId);
        await _notificationService.SendToUserAsync(
            request.RequestedByUserId,
            "Talebiniz Onaylandı",
            $"{module?.Name} modülündeki kaydınız onaylanmıştır.",
            NotificationType.Success,
            $"/modules/{moduleId}/records/{recordId}"
        );
    }

    public async Task RejectRecordAsync(int moduleId, int recordId, int userId, string reason)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var request = await _context.ApprovalRequests
            .Where(a => a.ModuleId == moduleId && a.ModuleRecordId == recordId && a.TenantId == tenantId && a.Status == "Pending")
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (request == null) throw new InvalidOperationException("No pending approval found for this record.");

        request.Status = "Rejected";
        request.ResolvedAt = DateTime.UtcNow;
        request.ResolvedByUserId = userId;
        request.Comments = reason;

        var record = await _context.ModuleRecords.FindAsync(recordId);
        if (record != null) record.ApprovalStatus = "Rejected";

        await _context.SaveChangesAsync();
        
        // Notification to requester
        var module = await _context.Modules.FindAsync(moduleId);
        await _notificationService.SendToUserAsync(
            request.RequestedByUserId,
            "Talebiniz Reddedildi",
            $"{module?.Name} modülündeki kaydınız reddedilmiştir. Sebep: {reason}",
            NotificationType.Error,
            $"/modules/{moduleId}/records/{recordId}"
        );
    }
}
