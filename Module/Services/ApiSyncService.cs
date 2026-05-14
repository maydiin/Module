using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Features.Records.Commands;

namespace Module.Services;

public class ApiSyncService : IApiSyncService
{
    private readonly AppDbContext _context;
    private readonly IExternalApiService _apiService;
    private readonly IModuleService _moduleService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IMediator _mediator;

    public ApiSyncService(
        AppDbContext context,
        IExternalApiService apiService,
        IModuleService moduleService,
        IHttpClientFactory httpClientFactory,
        IMediator mediator)
    {
        _context = context;
        _apiService = apiService;
        _moduleService = moduleService;
        _httpClientFactory = httpClientFactory;
        _mediator = mediator;
    }

    public async Task<ApiSyncResult> ExecuteSyncAsync(int configId, int tenantId, Dictionary<string, string>? parameters = null)
    {
        var config = await _context.ExternalApiConfigs
            .Include(c => c.Module)
            .FirstOrDefaultAsync(c => c.Id == configId && c.TenantId == tenantId);

        if (config == null)
        {
            return new ApiSyncResult { Message = "API Configuration not found." };
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
                return new ApiSyncResult { Message = $"API returned error: {response.StatusCode}" };
            }

            var apiResponseJson = await response.Content.ReadAsStringAsync();
            var (mappedRecords, mappingErrors) = _apiService.MapArrayResponse(apiResponseJson, config.ResponseMappingsJson ?? "{}", parameters);

            int createdCount = 0;
            int failedCount = 0;
            var validationErrors = new List<string>();

            validationErrors.AddRange(mappingErrors);
            failedCount += mappingErrors.Count;

            int recordIndex = 0;
            foreach (var recordJson in mappedRecords)
            {
                recordIndex++;
                try
                {
                    var data = _moduleService.DeserializeData(recordJson);
                    var recordErrors = await _moduleService.ValidateDataAsync(config.ModuleId, data);

                    if (recordErrors.Any())
                    {
                        failedCount++;
                        foreach (var err in recordErrors)
                        {
                            validationErrors.Add($"Record {recordIndex}: {err}");
                        }
                        continue;
                    }

                    await _mediator.Send(new CreateRecordCommand(config.ModuleId, data));
                    createdCount++;
                }
                catch (Exception ex)
                {
                    failedCount++;
                    validationErrors.Add($"Record {recordIndex}: Save Failed - {ex.Message}");
                }
            }

            // Update LastPolledAt
            config.LastPolledAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return new ApiSyncResult
            {
                Message = $"Sync completed. Created: {createdCount}, Failed: {failedCount}",
                ModuleName = config.Module?.Name ?? "Unknown",
                CreatedCount = createdCount,
                FailedCount = failedCount,
                Errors = validationErrors
            };
        }
        catch (Exception ex)
        {
            return new ApiSyncResult { Message = $"Internal error: {ex.Message}" };
        }
    }
}
