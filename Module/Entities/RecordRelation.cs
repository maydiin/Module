namespace Module.Entities;

public class RecordRelation
{
    public int Id { get; set; }
    
    public string SourceModule { get; set; } = string.Empty;
    public int SourceRecordId { get; set; }
    
    public string TargetModule { get; set; } = string.Empty;
    public int TargetRecordId { get; set; }
    
    public string FieldName { get; set; } = string.Empty;
}
