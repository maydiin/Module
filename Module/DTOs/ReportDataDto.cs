namespace Module.DTOs;

public class ReportDataDto
{
    public string ReportName { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    
    // For List reports
    public List<Dictionary<string, object>>? Rows { get; set; }
    public List<string>? Columns { get; set; }
    
    // For Chart reports
    public List<ChartDataPointDto>? ChartData { get; set; }
}

public class ChartDataPointDto
{
    public string Label { get; set; } = string.Empty;
    public decimal Value { get; set; }
    
    // Multi-dimensional data for Bubble, Heatmap, etc.
    public object? X { get; set; }
    public object? Y { get; set; }
    public decimal? Z { get; set; }
}
