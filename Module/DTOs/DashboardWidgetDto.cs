namespace Module.DTOs;

public class DashboardWidgetDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string WidgetType { get; set; } = string.Empty;
    public string Configuration { get; set; } = "{}";
    public int ColSpan { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateDashboardWidgetDto
{
    public string Title { get; set; } = string.Empty;
    public string WidgetType { get; set; } = "stat_card";
    public string Configuration { get; set; } = "{}";
    public int ColSpan { get; set; } = 1;
    public int SortOrder { get; set; } = 0;
}

public class UpdateDashboardWidgetDto
{
    public string? Title { get; set; }
    public string? WidgetType { get; set; }
    public string? Configuration { get; set; }
    public int? ColSpan { get; set; }
    public int? SortOrder { get; set; }
}

public class WidgetDataDto
{
    public string WidgetType { get; set; } = string.Empty;
    // stat_card
    public decimal? StatValue { get; set; }
    public string? StatLabel { get; set; }
    // chart
    public List<ChartDataPointDto>? ChartData { get; set; }
    // recent_records
    public List<Dictionary<string, object>>? Rows { get; set; }
    public List<string>? Columns { get; set; }
    public List<object>? ColumnMeta { get; set; }
    // module context
    public string? ModuleName { get; set; }
}
