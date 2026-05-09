using Module.DTOs;

namespace Module.Services;

public interface IDashboardService
{
    Task<WidgetDataDto> GetWidgetDataAsync(int widgetId, int tenantId, int userId);
}
