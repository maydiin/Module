using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Services;
using System.Text.Json;

namespace Module.Controllers;

[ApiController]
[Route("api/sync")]
public class ApiSyncController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IExternalApiService _apiService;
    private readonly IModuleService _moduleService;
    private readonly IRelationService _relationService;
    private readonly IHttpClientFactory _httpClientFactory;

    public ApiSyncController(
        AppDbContext context, 
        IExternalApiService apiService, 
        IModuleService moduleService, 
        IRelationService relationService,
        IHttpClientFactory httpClientFactory)
    {
        _context = context;
        _apiService = apiService;
        _moduleService = moduleService;
        _relationService = relationService;
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost("{configId}/execute")]
    public async Task<IActionResult> ExecuteSync(int configId, [FromBody] Dictionary<string, string>? parameters = null)
    {
        var config = await _context.ExternalApiConfigs
            .Include(c => c.Module)
            .FirstOrDefaultAsync(c => c.Id == configId);
 
        if (config == null) return NotFound("API Configuration not found.");
 
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
            var mappedRecords = _apiService.MapArrayResponse(apiResponseJson, config.ResponseMappingsJson ?? "{}", parameters);
 
            int createdCount = 0;
            foreach (var recordJson in mappedRecords)
            {
                var data = _moduleService.DeserializeData(recordJson);
                
                // Optional: Check for duplicates based on a unique field if needed
                // For now, just create new records
                
                var record = new ModuleRecord
                {
                    ModuleId = config.ModuleId,
                    Data = recordJson,
                    CreatedAt = DateTime.UtcNow
                };
 
                _context.ModuleRecords.Add(record);
                await _context.SaveChangesAsync(); // Save one by one to use record.Id for relations
                
                // Save relations for the new record
                await _relationService.SaveRelations(config.Module.Name, record.Id, record);
                
                createdCount++;
            }
 
            return Ok(new { message = $"Successfully synced {createdCount} records.", module = config.Module.Name });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Internal error: {ex.Message}");
        }
    }
}
