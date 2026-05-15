using Microsoft.AspNetCore.Mvc;
using Module.DTOs.Ai;
using Module.Services.Ai;

namespace Module.Controllers;

[ApiController]
[Route("api/ai")]
[Microsoft.AspNetCore.Authorization.Authorize]
public class AiQueryController : ControllerBase
{
    private readonly IAiGenerationService _aiService;

    public AiQueryController(IAiGenerationService aiService)
    {
        _aiService = aiService;
    }

    [HttpPost("query")]
    public async Task<ActionResult<AiQueryResponseDto>> GenerateFilters([FromBody] AiQueryRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
        {
            return BadRequest(new { error = "Prompt is required" });
        }

        try
        {
            var result = await _aiService.GenerateQueryFiltersAsync(request.ModuleId, request.Prompt);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
