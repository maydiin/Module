using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Module.DTOs.Ai;
using Module.Services.Ai;

namespace Module.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CopilotController : ControllerBase
{
    private readonly IAiCopilotService _aiCopilotService;
    private readonly ILogger<CopilotController> _logger;

    public CopilotController(IAiCopilotService aiCopilotService, ILogger<CopilotController> logger)
    {
        _aiCopilotService = aiCopilotService;
        _logger = logger;
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] CopilotRequestDto request)
    {
        if (request == null || string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest("Message cannot be empty.");
        }

        try
        {
            var response = await _aiCopilotService.ProcessChatAsync(request);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing copilot chat.");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}
