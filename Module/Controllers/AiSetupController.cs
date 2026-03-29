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

        var response = await _aiGenerationService.GenerateConfigAsync(request.Prompt, request.History);
        return Ok(response);
    }

    [HttpPost("generate-report/{moduleId}")]
    public async Task<IActionResult> GenerateReport(int moduleId, [FromBody] AiGenerationRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        var response = await _aiGenerationService.GenerateReportConfigAsync(moduleId, request.Prompt, request.History);
        return Ok(response);
    }

    [HttpPost("generate-api-config/{moduleId}")]
    public async Task<IActionResult> GenerateApiConfig(int moduleId, [FromBody] AiGenerationRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        var response = await _aiGenerationService.GenerateApiConfigAsync(moduleId, request.Prompt, request.History);
        return Ok(response);
    }

    [HttpPost("generate-script/{moduleId}")]
    public async Task<IActionResult> GenerateScript(int moduleId, [FromBody] AiGenerationRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Prompt))
            return BadRequest("Prompt is required.");

        var response = await _aiGenerationService.GenerateScriptConfigAsync(moduleId, request.Prompt, request.History);
        return Ok(response);
    }
}


