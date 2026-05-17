namespace Module.Services;

public interface IApprovalService
{
    Task RequestApprovalAsync(int moduleId, int moduleRecordId, string? roleName, string? message);
    Task ApproveRecordAsync(int moduleId, int recordId, int userId);
    Task RejectRecordAsync(int moduleId, int recordId, int userId, string reason);
}
