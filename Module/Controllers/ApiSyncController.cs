using Microsoft.AspNetCore.Authorization;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Features.Records.Commands;
using Module.Services;
using System.Text.Json;

namespace Module.Controllers;

[ApiController]
[Route("api/sync")]
[Authorize]
public class ApiSyncController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IExternalApiService _apiService;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMediator _mediator;
    private readonly IAuthorizationService _authorizationService;
    private readonly ITenantService _tenantService;

    public ApiSyncController(
        AppDbContext context, 
        IExternalApiService apiService, 
        IModuleService moduleService, 
        IRelationService relationService,
        IHttpClientFactory httpClientFactory,
        IMediator mediator,
        IAuthorizationService authorizationService,
        ITenantService tenantService)
    {
        _context = context;
        _apiService = apiService;
        _moduleService = moduleService;
        _relationService = relationService;
        _httpClientFactory = httpClientFactory;
        _mediator = mediator;
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
        var permissionName = $"Module.{config.Module.Name}.Api";
        var authResult = await _authorizationService.AuthorizeAsync(User, permissionName);
        
        if (!authResult.Succeeded)
        {
            return Forbid();
        }
 
        try
        {
            var client = _httpClientFactory.CreateClient();
            
            // Add custom headers
            if (!string.IsNullOrEmpty(config.HeadersJson))
            {
                var headers = JsonSerializer.Deserialize<Dictionary<string, string>>(config.HeadersJson);
                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        client.DefaultRequestHeaders.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }
            }
 
            HttpResponseMessage response;
            string url = _apiService.PrepareTemplate(config.Url, "{}", parameters);
 
            if (config.Method == "POST")
            {
                string body = _apiService.PrepareTemplate(config.RequestBodyTemplate ?? "{}", "{}", parameters);
                var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
                response = await client.PostAsync(url, content);
            }
            else
            {
                response = await client.GetAsync(url);
            }
 
            if (!response.IsSuccessStatusCode)
            {
                return BadRequest($"API returned error: {response.StatusCode}");
            }
 
            var apiResponseJson = await response.Content.ReadAsStringAsync();
            var (mappedRecords, mappingErrors) = _apiService.MapArrayResponse(apiResponseJson, config.ResponseMappingsJson ?? "{}", parameters);
 
            int createdCount = 0;
            int failedCount = 0;
            var validationErrors = new List<string>();

            // Add mapping errors directly to validation errors with a prefix
            validationErrors.AddRange(mappingErrors);
            failedCount += mappingErrors.Count;

            int recordIndex = 0;
            foreach (var recordJson in mappedRecords)
            {
                recordIndex++;
                try
                {
                    var data = _moduleService.DeserializeData(recordJson);
                    
                    // Validate data against module fields
                    var recordErrors = await _moduleService.ValidateDataAsync(config.ModuleId, data);
                    
                    if (recordErrors.Any())
                    {
                         failedCount++;
                         foreach(var err in recordErrors)
                         {
                             validationErrors.Add($"Record {recordIndex}: {err}");
                         }
                         continue; // Skip saving this record
                    }

                    // Use CreateRecordCommand to handle formula computation and validation
                    await _mediator.Send(new CreateRecordCommand(config.ModuleId, data));
                    
                    createdCount++;
                }
                catch (Exception ex)
                {
                    failedCount++;
                    validationErrors.Add($"Record {recordIndex}: Save Failed - {ex.Message}");
                }
            }
 
            var result = new 
            { 
                message = $"Sync completed. Created: {createdCount}, Failed: {failedCount}", 
                module = config.Module.Name,
                createdCount,
                failedCount,
                errors = validationErrors
            };

            if (failedCount > 0)
            {
                // Return 200 OK but with error details, or 400 if you prefer strictly calling it a bad request.
                // Usually for a partial success batch job, 200 with details is common, 
                // but if we want to alert the user strongly, we can assume the client checks the 'errors' field.
                return Ok(result);
            }
 
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal error: {ex.Message}");
        }
    }
}

