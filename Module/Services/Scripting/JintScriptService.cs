using Jint;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Entities;
using Module.Common;

namespace Module.Services.Scripting;

public class JintScriptService : IScriptService
{
    private readonly AppDbContext _context;
    private readonly IScriptDbHelper _dbHelper;
    private readonly ITenantService _tenantService;
    private readonly IScriptApiHelper _apiHelper;

    public JintScriptService(AppDbContext context, IScriptDbHelper dbHelper, ITenantService tenantService, IScriptApiHelper apiHelper)
    {
        _context = context;
        _dbHelper = dbHelper;
        _tenantService = tenantService;
        _apiHelper = apiHelper;
    }

    public async Task<PagedResult<ModuleRecordDto>?> ExecuteListOverrideAsync(int moduleId, int tenantId, RecordQueryOptions options)
    {
        var script = await GetScript(moduleId, tenantId, "CustomList");
        if (script == null || !script.IsActive) return null;

        using var engine = new Engine(cfg => cfg
            .LimitMemory(4_000_000) // 4MB limit
            .TimeoutInterval(TimeSpan.FromSeconds(4)) // 4s timeout
            .MaxStatements(10000));

        var context = new ScriptContext
        {
            Db = _dbHelper,
            Data = new Dictionary<string, object>(), // No single record data for listing
            User = new CurrentUserDto { Id = 0, Username = "System" } // TODO: Get real user
        };

        // Inject context
        engine.SetValue("Db", context.Db);
        engine.SetValue("Options", options);
        engine.SetValue("Fail", new Action<string>(context.Fail));
        engine.SetValue("Log", new Action<string>(context.Log));
        
        // Inject Api Helper
        // We create a wrapper to pass the moduleId automatically so the user doesn't have to
        Func<string, Dictionary<string, object>, object> executeApi = (configName, parameters) => 
            _apiHelper.ExecuteAsync(moduleId, configName, parameters).GetAwaiter().GetResult();
            
        engine.SetValue("Api", new { Execute = executeApi });

        try 
        {
            var result = engine.Evaluate(script.ScriptContent).ToObject();
            
            // Expected result: { Items: [], Total: 0 }
            // We need to map this back to PagedResult<ModuleRecordDto>
            // This part requires careful mapping from dynamic/JS object to C# DTO
            
            // For now, let's assume the script returns a JSON string or a specific object structure
            // Returning null means "fall back to default"
            return null; 
        }
        catch (Exception ex)
        {
           Console.WriteLine($"Script Error: {ex.Message}");
           return null; // Fallback on error
        }
    }

    public async Task ExecuteBeforeHookAsync(string trigger, int moduleId, Dictionary<string, object> data)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var script = await GetScript(moduleId, tenantId, trigger);
        if (script == null || !script.IsActive) return;

        ExecuteHook(script.ScriptContent, moduleId, data);
    }

    public async Task ExecuteAfterHookAsync(string trigger, int moduleId, Dictionary<string, object> data)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var script = await GetScript(moduleId, tenantId, trigger);
        if (script == null || !script.IsActive) return;

        ExecuteHook(script.ScriptContent, moduleId, data);
    }

    private void ExecuteHook(string scriptContent, int moduleId, Dictionary<string, object> data)
    {
        using var engine = new Engine(cfg => cfg
            .LimitMemory(4_000_000) // 4MB limit
            .TimeoutInterval(TimeSpan.FromSeconds(4)) // 4s timeout
            .MaxStatements(10000));

        data.Normalize();

        var context = new ScriptContext
        {
            Db = _dbHelper,
            Data = data,
            User = new CurrentUserDto { Id = 0, Username = "System" } // TODO: Get real user
        };

        engine.SetValue("Db", context.Db);
        engine.SetValue("Data", context.Data);
        engine.SetValue("User", context.User);
        engine.SetValue("Fail", new Action<string>(context.Fail));
        engine.SetValue("Log", new Action<string>(context.Log));

        // Inject Api Helper
        Func<string, Dictionary<string, object>, object> executeApi = (configName, parameters) => 
            _apiHelper.ExecuteAsync(moduleId, configName, parameters).GetAwaiter().GetResult();
            
        engine.SetValue("Api", new { Execute = executeApi });

        engine.Execute(scriptContent);
    }

    private async Task<ModuleScript?> GetScript(int moduleId, int tenantId, string trigger)
    {
        // 1. Try specific tenant script
        var script = await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.ModuleId == moduleId && s.TenantId == tenantId && s.TriggerType == trigger && s.IsActive);
            
        if (script != null) return script;

        // 2. Try global script (TenantId is null)
        return await _context.ModuleScripts
            .FirstOrDefaultAsync(s => s.ModuleId == moduleId && s.TenantId == null && s.TriggerType == trigger && s.IsActive);
    }
}
