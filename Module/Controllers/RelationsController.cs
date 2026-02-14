using Microsoft.AspNetCore.Mvc;
using Module.DTOs;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/relations")]
public class RelationsController : ControllerBase
{
    private readonly IRelationService _relationService;

    public RelationsController(IRelationService relationService)
    {
        _relationService = relationService;
    }

    [HttpGet("used-in")]
    public async Task<ActionResult<List<RelationDto>>> GetUsedIn([FromQuery] string module, [FromQuery] int id)
    {
        if (string.IsNullOrEmpty(module))
        {
            return BadRequest(new { error = "Module name is required" });
        }

        var relations = await _relationService.GetUsedIn(module, id);
        return Ok(relations);
    }
    
    [HttpGet("summary")]
    public async Task<ActionResult<List<RelationSummaryDto>>> GetSummary([FromQuery] string module, [FromQuery] int id)
    {
        if (string.IsNullOrEmpty(module))
        {
            return BadRequest(new { error = "Module name is required" });
        }

        var summary = await _relationService.GetRelationSummary(module, id);
        return Ok(summary);
    }

    [HttpGet("details")]
    public async Task<ActionResult<List<RelationDto>>> GetDetails(
        [FromQuery] string module, 
        [FromQuery] int id, 
        [FromQuery] string sourceModule, 
        [FromQuery] int page = 1, 
        [FromQuery] int pageSize = 10)
    {
        if (string.IsNullOrEmpty(module) || string.IsNullOrEmpty(sourceModule))
        {
            return BadRequest(new { error = "Module name and Source Module name are required" });
        }

        var relations = await _relationService.GetRelatedRecords(module, id, sourceModule, page, pageSize);
        return Ok(relations);
    }
}
