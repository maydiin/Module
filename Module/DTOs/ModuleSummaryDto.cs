using System;
using System.Collections.Generic;

namespace Module.DTOs;

public class ModuleSummaryDto
{
    public int ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public List<ModuleFieldDto> Fields { get; set; } = new();
    public List<ModuleRecordDto> LatestRecords { get; set; } = new();
}
