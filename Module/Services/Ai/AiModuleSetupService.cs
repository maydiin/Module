using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs.Ai;
using Module.Entities;

namespace Module.Services.Ai;

public class AiModuleSetupService : IAiModuleSetupService
{
    private readonly AppDbContext _context;
    private readonly ITenantService _tenantService;

    public AiModuleSetupService(AppDbContext context, ITenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    public async Task ApplyConfigAsync(AiSystemConfigDto config)
    {
        var tenantId = _tenantService.GetCurrentTenantId();

        using var transaction = await _context.Database.BeginTransactionAsync();
        try
        {
            // 1. Create or Update Modules
            var moduleNameMap = await _context.Modules
                .Where(m => m.TenantId == tenantId)
                .ToDictionaryAsync(m => m.Name, m => m.Id);

            foreach (var moduleConfig in config.Modules)
            {
                var existingModule = await _context.Modules
                    .FirstOrDefaultAsync(m => m.Name == moduleConfig.Name && m.TenantId == tenantId);

                if (existingModule == null)
                {
                    var newModule = new Module.Entities.Module
                    {
                        Name = moduleConfig.Name,
                        TenantId = tenantId,
                        AuditCreate = moduleConfig.AuditCreate,
                        AuditUpdate = moduleConfig.AuditUpdate,
                        AuditDelete = moduleConfig.AuditDelete
                    };
                    _context.Modules.Add(newModule);
                    await _context.SaveChangesAsync();
                    moduleNameMap[moduleConfig.Name] = newModule.Id;

                    // Automatically create permissions and assign to Admin
                    await CreateModulePermissions(newModule.Name, tenantId);
                }
                else
                {
                    // Update existing module
                    existingModule.AuditCreate = moduleConfig.AuditCreate;
                    existingModule.AuditUpdate = moduleConfig.AuditUpdate;
                    existingModule.AuditDelete = moduleConfig.AuditDelete;
                    
                    _context.Modules.Update(existingModule);
                    await _context.SaveChangesAsync();
                    
                    moduleNameMap[moduleConfig.Name] = existingModule.Id;
                }
            }

            // 2. Create or Update Fields
            foreach (var moduleConfig in config.Modules)
            {
                if (!moduleNameMap.TryGetValue(moduleConfig.Name, out var moduleId)) continue;

                foreach (var fieldConfig in moduleConfig.Fields)
                {
                    // Check if field exists
                    var existingField = await _context.ModuleFields
                        .FirstOrDefaultAsync(f => f.ModuleId == moduleId && f.Name == fieldConfig.Name);

                    if (existingField == null)
                    {
                        var newField = new ModuleField
                        {
                            ModuleId = moduleId,
                            Name = fieldConfig.Name,
                            Label = fieldConfig.Label,
                            Type = fieldConfig.Type,
                            Required = fieldConfig.Required,
                            Options = fieldConfig.Options,
                            OrderNo = fieldConfig.OrderNo,
                            IsStored = true, // Default to true based on logic
                            IsDisplayField = fieldConfig.IsDisplayField
                        };
                        _context.ModuleFields.Add(newField);
                    }
                    else
                    {
                        // Update existing field
                        existingField.Label = fieldConfig.Label;
                        existingField.Type = fieldConfig.Type;
                        existingField.Required = fieldConfig.Required;
                        existingField.Options = fieldConfig.Options;
                        existingField.OrderNo = fieldConfig.OrderNo;
                        existingField.IsDisplayField = fieldConfig.IsDisplayField;
                        
                        _context.ModuleFields.Update(existingField);
                    }
                }
            }
            await _context.SaveChangesAsync();

            // 3. Create or Update Scripts
            foreach (var scriptConfig in config.Scripts)
            {
                if (!moduleNameMap.TryGetValue(scriptConfig.ModuleName, out var moduleId)) continue;

                var existingScript = await _context.ModuleScripts
                    .FirstOrDefaultAsync(s => s.ModuleId == moduleId && s.TenantId == tenantId && s.TriggerType == scriptConfig.TriggerType);

                if (existingScript == null)
                {
                    var newScript = new ModuleScript
                    {
                        ModuleId = moduleId,
                        TenantId = tenantId,
                        TriggerType = scriptConfig.TriggerType,
                        ScriptContent = scriptConfig.ScriptContent,
                        IsActive = scriptConfig.IsActive
                    };
                    _context.ModuleScripts.Add(newScript);
                }
                else
                {
                    // Update existing script
                    existingScript.ScriptContent = scriptConfig.ScriptContent;
                    existingScript.IsActive = scriptConfig.IsActive;
                    
                    _context.ModuleScripts.Update(existingScript);
                }
            }
            await _context.SaveChangesAsync();

            // 4. Create or Update API Configs
            foreach (var apiConfig in config.ApiConfigs)
            {
                if (!moduleNameMap.TryGetValue(apiConfig.ModuleName, out var moduleId)) continue;

                var existingApi = await _context.ExternalApiConfigs
                    .FirstOrDefaultAsync(a => a.ModuleId == moduleId && a.Name == apiConfig.Name);

                if (existingApi == null)
                {
                    var newApi = new ExternalApiConfig
                    {
                        ModuleId = moduleId,
                        Name = apiConfig.Name,
                        Url = apiConfig.Url,
                        Method = apiConfig.Method,
                        HeadersJson = apiConfig.HeadersJson,
                        RequestBodyTemplate = apiConfig.RequestBodyTemplate,
                        ResponseMappingsJson = apiConfig.ResponseMappingsJson
                    };
                    _context.ExternalApiConfigs.Add(newApi);
                }
                else
                {
                    // Update existing API config
                    existingApi.Url = apiConfig.Url;
                    existingApi.Method = apiConfig.Method;
                    existingApi.HeadersJson = apiConfig.HeadersJson;
                    existingApi.RequestBodyTemplate = apiConfig.RequestBodyTemplate;
                    existingApi.ResponseMappingsJson = apiConfig.ResponseMappingsJson;
                    
                    _context.ExternalApiConfigs.Update(existingApi);
                }
            }
            await _context.SaveChangesAsync();

            // 5. Create or Update Reports
            if (config.Reports != null)
            {
                foreach (var reportConfig in config.Reports)
                {
                    if (!moduleNameMap.TryGetValue(reportConfig.ModuleName, out var moduleId)) continue;

                    var existingReport = await _context.ModuleReports
                        .FirstOrDefaultAsync(r => r.ModuleId == moduleId && r.TenantId == tenantId && r.Name == reportConfig.Name);

                    if (existingReport == null)
                    {
                        var newReport = new ModuleReport
                        {
                            ModuleId = moduleId,
                            TenantId = tenantId,
                            Name = reportConfig.Name,
                            Type = reportConfig.Type,
                            Configuration = reportConfig.Configuration,
                            IsActive = reportConfig.IsActive
                        };
                        _context.ModuleReports.Add(newReport);
                    }
                    else
                    {
                        // Update existing report
                        existingReport.Type = reportConfig.Type;
                        existingReport.Configuration = reportConfig.Configuration;
                        existingReport.IsActive = reportConfig.IsActive;

                        _context.ModuleReports.Update(existingReport);
                    }
                }
                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task CreateModulePermissions(string moduleName, int? tenantId)
    {
        // Define standard permissions
        var actions = new[] { "View", "Create", "Update", "Delete", "Manage", "Api", "Script" };
        var createdPermissions = new List<Permission>();

        foreach (var action in actions)
        {
            var permName = $"Module.{moduleName}.{action}";
            string description;

            if (action == "Manage")
                description = $"Can manage {moduleName} schema";
            else if (action == "Api")
                description = $"Can manage {moduleName} API integrations";
            else if (action == "Script")
                description = $"Can manage {moduleName} dynamic scripts";
            else
                description = $"Can {action.ToLower()} {moduleName} records";

            // Check if permission already exists (to be safe, though this is a new module)
            var existingPerm = await _context.Permissions
                .FirstOrDefaultAsync(p => p.Name == permName && p.TenantId == tenantId);

            if (existingPerm == null)
            {
                var permission = new Permission
                {
                    Name = permName,
                    Description = description,
                    TenantId = tenantId
                };
                _context.Permissions.Add(permission);
                createdPermissions.Add(permission);
            }
            else
            {
                createdPermissions.Add(existingPerm);
            }
        }

        await _context.SaveChangesAsync();

        // Assign these permissions to the tenant's Admin role
        var adminRole = await _context.Roles
            .FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == tenantId);

        if (adminRole != null)
        {
            foreach (var perm in createdPermissions)
            {
                // Check if already assigned
                var exists = await _context.RolePermissions
                    .AnyAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == perm.Id);

                if (!exists)
                {
                    _context.RolePermissions.Add(new RolePermission
                    {
                        RoleId = adminRole.Id,
                        PermissionId = perm.Id
                    });
                }
            }
            await _context.SaveChangesAsync();
        }
    }
}
