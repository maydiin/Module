using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Entities;
using Module.Common;

namespace Module.Services.Scripting;

public class ScriptDbHelper : IScriptDbHelper
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;
    private readonly IServiceProvider _serviceProvider;

    public ScriptDbHelper(AppDbContext context, ITenantService tenantService, IServiceProvider serviceProvider)
    {
        _context = context;
        _tenantService = tenantService;
        _serviceProvider = serviceProvider;
    }

    public void RequestApproval(string moduleName, int recordId, string? roleName, string? message, int? timeoutHours = null, string? escalationAction = null, string? escalateToRole = null)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var module = _context.Modules.FirstOrDefault(m => m.Name == moduleName && m.TenantId == tenantId);
        if (module == null) throw new InvalidOperationException($"Module '{moduleName}' not found.");

        var approvalService = _serviceProvider.GetRequiredService<IApprovalService>();
        // Wait synchronously since Jint is synchronous
        approvalService.RequestApprovalAsync(module.Id, recordId, roleName, message, timeoutHours, escalationAction, escalateToRole).GetAwaiter().GetResult();
    }

    public IScriptModuleHelper Module(string moduleName)
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        return new ScriptModuleHelper(_context, moduleName, tenantId);
    }
}

public class ScriptModuleHelper : IScriptModuleHelper
{
    private readonly AppDbContext _context;
    private readonly string _moduleName;
    private readonly int _tenantId;
    private readonly Module.Entities.Module? _module;

    public ScriptModuleHelper(AppDbContext context, string moduleName, int tenantId)
    {
        _context = context;
        _moduleName = moduleName;
        _tenantId = tenantId;
        
        // Securely find the module for the current tenant
        _module = _context.Modules
            .FirstOrDefault(m => m.Name == moduleName && m.TenantId == tenantId);
    }

    public dynamic? Find(int id)
    {
        if (_module == null) return null;

        // Ensure the record belongs to the tenant
        var record = _context.ModuleRecords
            .FirstOrDefault(r => r.ModuleId == _module.Id && r.Id == id && r.TenantId == _tenantId);
            
        if (record == null) return null;

        try 
        {
            var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(record.Data);
            if (data == null) return null;

            data.Normalize();

            data["Id"] = record.Id;
            data["CreatedAt"] = record.CreatedAt;
            return data;
        }
        catch
        {
            return null;
        }
    }

    public void Update(int id, object data)
    {
        if (_module == null) return;

        // Ensure the record belongs to the tenant
        var record = _context.ModuleRecords
            .FirstOrDefault(r => r.ModuleId == _module.Id && r.Id == id && r.TenantId == _tenantId);
            
        if (record == null) return;

        // Serialize the data back to JSON
        var json = System.Text.Json.JsonSerializer.Serialize(data);
        record.Data = json;
        
        _context.SaveChanges();
    }
}
