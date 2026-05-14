using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Services;

namespace Module.Controllers;

[ApiController]
[Route("api/sync")]
[Authorize]
public class ApiSyncController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IApiSyncService _apiSyncService;
    private readonly IAuthorizationService _authorizationService;
    private readonly ITenantService _tenantService;

    public ApiSyncController(
        AppDbContext context,
        IApiSyncService apiSyncService,
        IAuthorizationService authorizationService,
        ITenantService tenantService)
    {
        _context = context;
        _apiSyncService = apiSyncService;
        _authorizationService = authorizationService;
        _tenantService = tenantService;
    }

    [HttpPost("{configId}/execute")]
    public async Task<IActionResult> ExecuteSync(int configId, [FromBody] Dictionary<string, string>? parameters = null)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var config = await _context.ExternalApiConfigs
            .Include(c => c.Module)
            .FirstOrDefaultAsync(c => c.Id == configId && c.TenantId == tenantId);

        if (config == null) return NotFound("API Configuration not found.");

        // Check Permissions
        var permissionName = $"Module.{config.Module!.Name}.Api";
        var authResult = await _authorizationService.AuthorizeAsync(User, permissionName);
        
        if (!authResult.Succeeded)
        {
            return Forbid();
        }

        var result = await _apiSyncService.ExecuteSyncAsync(configId, tenantId, parameters);
        return Ok(result);
    }
}
