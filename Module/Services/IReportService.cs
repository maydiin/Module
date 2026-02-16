using Module.DTOs;

namespace Module.Services;

public interface IReportService
{
    Task<ReportDataDto> ExecuteReportAsync(int moduleId, int reportId, int tenantId);
}
