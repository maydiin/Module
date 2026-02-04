namespace Module.Entities;

public class ModuleRecord
{
    public int Id { get; set; }
    public int ModuleId { get; set; }
    public string Data { get; set; } = string.Empty; // JSON stored as nvarchar(max)
    public DateTime CreatedAt { get; set; }
    
    public Module Module { get; set; } = null!;
}

