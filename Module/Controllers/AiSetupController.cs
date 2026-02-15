using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Module.DTOs.Ai;
using Module.Services.Ai;

namespace Module.Controllers;

[ApiController]
[Route("api/ai-setup")]
[Authorize]
public class AiSetupController : ControllerBase
{
    private readonly IAiModuleSetupService _aiModuleSetupService;
    private readonly IAiGenerationService _aiGenerationService;

    public AiSetupController(IAiModuleSetupService aiModuleSetupService, IAiGenerationService aiGenerationService)
    {
        _aiModuleSetupService = aiModuleSetupService;
        _aiGenerationService = aiGenerationService;
    }

    [HttpPost]
    public async Task<IActionResult> Setup([FromBody] AiSystemConfigDto config)
    {
        await _aiModuleSetupService.ApplyConfigAsync(config);
        return Ok(new { message = "System setup completed successfully." });
    }

    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] AiGenerationRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        var config = await _aiGenerationService.GenerateConfigAsync(request.Prompt);
        return Ok(config);
    }
}


