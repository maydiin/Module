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

    public async Task RequestApprovalAsync(int moduleId, int moduleRecordId, string? roleName, string? message, int? timeoutHours = null, string? escalationAction = null, string? escalateToRole = null)
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

        int? escalateToRoleId = null;
        if (!string.IsNullOrEmpty(escalateToRole))
        {
            var role = await _context.Roles.FirstOrDefaultAsync(r => r.Name == escalateToRole && r.TenantId == tenantId);
            if (role != null) escalateToRoleId = role.Id;
        }

        // Check if there is an existing pending ApprovalRequest for this record
        var approvalRequest = await _context.ApprovalRequests
            .Include(a => a.Stages)
            .FirstOrDefaultAsync(a => a.ModuleRecordId == moduleRecordId && a.ModuleId == moduleId && a.TenantId == tenantId && a.Status == "Pending");

        bool isNewRequest = false;
        if (approvalRequest == null)
        {
            approvalRequest = new ApprovalRequest
            {
                ModuleId = moduleId,
                ModuleRecordId = moduleRecordId,
                RequestedByUserId = GetCurrentUserId(),
                Status = "Pending",
                CurrentStage = 1,
                Message = message,
                TenantId = tenantId
            };
            _context.ApprovalRequests.Add(approvalRequest);
            isNewRequest = true;
            record.ApprovalStatus = "Pending";
        }

        int stageOrder = 1;
        if (!isNewRequest)
        {
            stageOrder = await _context.ApprovalStages.CountAsync(s => s.ApprovalRequestId == approvalRequest.Id) + 1;
        }

        var approvalStage = new ApprovalStage
        {
            ApprovalRequest = approvalRequest,
            StageOrder = stageOrder,
            Name = $"{roleName ?? "Belirtilmemiş"} Onay Aşaması",
            AssignedToRoleId = assignedRoleId,
            AssignedToUserId = null,
            Status = (stageOrder == 1) ? "Pending" : "Waiting",
            Message = message,
            TimeoutHours = timeoutHours,
            EscalationAction = escalationAction,
            EscalateToRoleId = escalateToRoleId,
            TenantId = tenantId
        };

        if (stageOrder == 1 && timeoutHours.HasValue && timeoutHours.Value > 0)
        {
            approvalStage.EscalationDeadline = DateTime.UtcNow.AddHours(timeoutHours.Value);
        }

        _context.ApprovalStages.Add(approvalStage);
        await _context.SaveChangesAsync();

        // Send notification to role if it is the first stage (Pending)
        if (stageOrder == 1 && assignedRoleId.HasValue)
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
            .Include(a => a.Stages)
            .Where(a => a.ModuleId == moduleId && a.ModuleRecordId == recordId && a.TenantId == tenantId && a.Status == "Pending")
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (request == null) throw new InvalidOperationException("No pending approval found for this record.");

        // Find active stage
        var activeStage = request.Stages
            .FirstOrDefault(s => s.StageOrder == request.CurrentStage && s.Status == "Pending");

        if (activeStage == null) throw new InvalidOperationException($"Active approval stage {request.CurrentStage} not found.");

        activeStage.Status = "Approved";
        activeStage.ResolvedAt = DateTime.UtcNow;
        activeStage.ResolvedByUserId = userId > 0 ? userId : null;

        // Check if there is a next waiting stage
        var nextStage = request.Stages
            .OrderBy(s => s.StageOrder)
            .FirstOrDefault(s => s.StageOrder > request.CurrentStage && s.Status == "Waiting");

        if (nextStage != null)
        {
            nextStage.Status = "Pending";
            request.CurrentStage = nextStage.StageOrder;

            if (nextStage.TimeoutHours.HasValue && nextStage.TimeoutHours.Value > 0)
            {
                nextStage.EscalationDeadline = DateTime.UtcNow.AddHours(nextStage.TimeoutHours.Value);
            }

            await _context.SaveChangesAsync();

            // Send notification to next stage role
            if (nextStage.AssignedToRoleId.HasValue)
            {
                var module = await _context.Modules.FindAsync(moduleId);
                await _notificationService.SendToRolesAsync(
                    new List<int> { nextStage.AssignedToRoleId.Value },
                    "Sıradaki Onay Bekliyor",
                    $"{module?.Name} modülünde onay sırası sizde: {nextStage.Message}",
                    NotificationType.Warning,
                    $"/modules/{moduleId}/records/{recordId}"
                );
            }
        }
        else
        {
            // All stages approved, request complete!
            request.Status = "Approved";
            request.ResolvedAt = DateTime.UtcNow;
            request.ResolvedByUserId = userId > 0 ? userId : null;

            var record = await _context.ModuleRecords.FindAsync(recordId);
            if (record != null) record.ApprovalStatus = "Approved";

            await _context.SaveChangesAsync();
            
            // Notification to requester
            var module = await _context.Modules.FindAsync(moduleId);
            await _notificationService.SendToUserAsync(
                request.RequestedByUserId,
                "Talebiniz Onaylandı",
                $"{module?.Name} modülündeki kaydınız tamamen onaylanmıştır.",
                NotificationType.Success,
                $"/modules/{moduleId}/records/{recordId}"
            );
        }
    }

    public async Task RejectRecordAsync(int moduleId, int recordId, int userId, string reason)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var request = await _context.ApprovalRequests
            .Include(a => a.Stages)
            .Where(a => a.ModuleId == moduleId && a.ModuleRecordId == recordId && a.TenantId == tenantId && a.Status == "Pending")
            .OrderByDescending(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (request == null) throw new InvalidOperationException("No pending approval found for this record.");

        // Find active stage
        var activeStage = request.Stages
            .FirstOrDefault(s => s.StageOrder == request.CurrentStage && s.Status == "Pending");

        if (activeStage != null)
        {
            activeStage.Status = "Rejected";
            activeStage.Comments = reason;
            activeStage.ResolvedAt = DateTime.UtcNow;
            activeStage.ResolvedByUserId = userId > 0 ? userId : null;
        }

        // Set all future waiting stages to skipped
        foreach (var stage in request.Stages.Where(s => s.Status == "Waiting" || s.Status == "Pending"))
        {
            stage.Status = "Skipped";
        }

        request.Status = "Rejected";
        request.ResolvedAt = DateTime.UtcNow;
        request.ResolvedByUserId = userId > 0 ? userId : null;
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
