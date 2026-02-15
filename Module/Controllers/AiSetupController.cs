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

    public AiSetupController(IAiModuleSetupService aiModuleSetupService)
    {
        _aiModuleSetupService = aiModuleSetupService;
    }

    [HttpPost]
    public async Task<IActionResult> Setup([FromBody] AiSystemConfigDto config)
    {
        await _aiModuleSetupService.ApplyConfigAsync(config);
        return Ok(new { message = "System setup completed successfully." });
    }
}
