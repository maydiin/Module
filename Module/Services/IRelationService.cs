using Module.Entities;
using Module.DTOs;

namespace Module.Services;

public interface IRelationService
{
    Task SaveRelations(string sourceModule, int sourceId, ModuleRecord record);
    Task<List<RelationDto>> GetUsedIn(string targetModule, int targetId);
    Task DeleteRelationsForSource(string sourceModule, int sourceId);
    Task<List<RelationSummaryDto>> GetRelationSummary(string targetModule, int targetId);
    Task<List<RelationDto>> GetRelatedRecords(string targetModule, int targetId, string sourceModule, int page, int pageSize);
}
