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
}
