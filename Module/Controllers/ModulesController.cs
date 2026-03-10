using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.DTOs;
using Module.Services;
using Module.FieldTypes;

namespace Module.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ModulesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITenantService _tenantService;
    private readonly IAuditLogService _auditLogService;
    private readonly AppDbContext _context;
    private readonly IModuleService _moduleService;
    private readonly FieldTypeFactory _fieldTypeFactory;

    public ModulesController(
        IUnitOfWork unitOfWork, 
        ITenantService tenantService, 
        IAuditLogService auditLogService,
        AppDbContext context,
        IModuleService moduleService,
        FieldTypeFactory fieldTypeFactory)
    {
        _unitOfWork = unitOfWork;
        _tenantService = tenantService;
        _auditLogService = auditLogService;
        _context = context;
        _moduleService = moduleService;
        _fieldTypeFactory = fieldTypeFactory;
    }

    [HttpPost]
    public async Task<IActionResult> CreateModule([FromBody] CreateModuleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(ApiResponse<object>.Fail("Module name is required"));
        }

        var tenantId = _tenantService.GetCurrentTenantId();

        var module = new Entities.Module
        {
            Name = dto.Name,
            TenantId = tenantId,
            AuditCreate = dto.AuditCreate,
            AuditUpdate = dto.AuditUpdate,
            AuditDelete = dto.AuditDelete
        };

        await _unitOfWork.Modules.AddAsync(module);
        await _unitOfWork.CompleteAsync();

        // Dynamically create permissions for the new module (tenant-scoped)
        var permissions = new[] { "View", "Create", "Update", "Delete", "Manage", "Api", "Script" };
        var createdPermissions = new List<Entities.Permission>();

        foreach (var action in permissions)
        {
            var permName = $"Module.{module.Name}.{action}";
            string description;

            if (action == "Manage")
                description = $"Can manage {module.Name} schema";
            else if (action == "Api")
                description = $"Can manage {module.Name} API integrations";
            else if (action == "Script")
                description = $"Can manage {module.Name} dynamic scripts";
            else
                description = $"Can {action.ToLower()} {module.Name} records";

            var permission = new Entities.Permission
            {
                Name = permName,
                Description = description,
                TenantId = tenantId
            };
            await _unitOfWork.Permissions.AddAsync(permission);
            createdPermissions.Add(permission);
        }

        await _unitOfWork.CompleteAsync();

        // Assign these permissions to the tenant's Admin role
        var adminRole = await _unitOfWork.Roles.AsQueryable().FirstOrDefaultAsync(r => r.Name == "Admin" && r.TenantId == tenantId);
        bool shouldRefreshToken = false;
        
        if (adminRole != null)
        {
            foreach (var perm in createdPermissions)
            {
                await _unitOfWork.RolePermissions.AddAsync(new Entities.RolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionId = perm.Id
                });
            }
            await _unitOfWork.CompleteAsync();
            
            // Check if the current user has the Admin role
            var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            shouldRefreshToken = await _unitOfWork.UserRoles.AsQueryable().AnyAsync(ur => ur.UserId == currentUserId && ur.RoleId == adminRole.Id);
        }

        await _auditLogService.LogAsync("Create", "Module", module.Id.ToString(), module.Name);

        return CreatedAtAction(nameof(GetModule), new { id = module.Id }, ApiResponse<object>.Ok(new
        {
            id = module.Id,
            name = module.Name,
            shouldRefreshToken = shouldRefreshToken
        }));
    }

    [HttpGet]
    public async Task<IActionResult> ListModules()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        
        var modules = await _unitOfWork.Modules.AsQueryable()
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.Name)
            .Select(m => new ModuleDto
            {
                Id = m.Id,
                Name = m.Name,
                AuditCreate = m.AuditCreate,
                AuditUpdate = m.AuditUpdate,
                AuditDelete = m.AuditDelete
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ModuleDto>>.Ok(modules));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetModule(int id)
    {
        var module = await _unitOfWork.Modules.GetByIdAsync(id);

        if (module == null)
        {
            return NotFound(ApiResponse<object>.Fail("Module not found"));
        }

        return Ok(ApiResponse<ModuleDto>.Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        }));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateModule(int id, [FromBody] UpdateModuleDto dto)
    {
        var module = await _unitOfWork.Modules.GetByIdAsync(id);
        if (module == null)
        {
            return NotFound(ApiResponse<object>.Fail("Module not found"));
        }

        // Check permission: Module.{Name}.Manage
        var permissionName = $"Module.{module.Name}.Manage";
        var hasPermission = User.HasClaim(c => c.Type == "Permission" && c.Value == permissionName) ||
                            User.IsInRole("Super Admin");

        if (!hasPermission)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var tenantId = _tenantService.GetCurrentTenantId();
            
            // Super Admin check again for safety
            var isSuperAdmin = await _unitOfWork.UserRoles.AsQueryable()
                .AnyAsync(ur => ur.UserId == userId && ur.Role.Name == "Super Admin");
                
            if (!isSuperAdmin)
            {
                var userPermissions = await _unitOfWork.UserRoles.AsQueryable()
                    .Where(ur => ur.UserId == userId)
                    .Join(_unitOfWork.RolePermissions.AsQueryable(), ur => ur.RoleId, rp => rp.RoleId, (ur, rp) => rp.PermissionId)
                    .Join(_unitOfWork.Permissions.AsQueryable().Where(p => p.TenantId == tenantId), pid => pid, p => p.Id, (pid, p) => p.Name)
                    .ToListAsync();
                    
                if (!userPermissions.Contains(permissionName))
                {
                    return Forbid();
                }
            }
        }

        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest(ApiResponse<object>.Fail("Module name is required"));
        }

        // Handle Rename
        if (!string.Equals(module.Name, dto.Name, StringComparison.OrdinalIgnoreCase))
        {
            // Check if new name exists
            if (await _unitOfWork.Modules.AsQueryable().AnyAsync(m => m.Name == dto.Name && m.TenantId == module.TenantId))
            {
                return BadRequest(ApiResponse<object>.Fail("Module with this name already exists"));
            }

            var oldName = module.Name;
            var newName = dto.Name;

            // Rename permissions
            var permissions = await _unitOfWork.Permissions.AsQueryable()
                .Where(p => p.Name.StartsWith($"Module.{oldName}."))
                .ToListAsync();

            foreach (var perm in permissions)
            {
                perm.Name = perm.Name.Replace($"Module.{oldName}.", $"Module.{newName}.");
                perm.Description = perm.Description.Replace(oldName, newName);
                _unitOfWork.Permissions.Update(perm);
            }

            var relations = await _unitOfWork.RecordRelations.AsQueryable()
                .Where(r => r.TargetModule == oldName)
                .ToListAsync();
            
            foreach (var rel in relations)
            {
                rel.TargetModule = newName;
                _unitOfWork.RecordRelations.Update(rel);
            }
            
            module.Name = newName;
        }

        module.AuditCreate = dto.AuditCreate;
        module.AuditUpdate = dto.AuditUpdate;
        module.AuditDelete = dto.AuditDelete;

        _unitOfWork.Modules.Update(module);
        await _unitOfWork.CompleteAsync();
        
        await _auditLogService.LogAsync("Update", "Module", module.Id.ToString(), module.Name);

        return Ok(ApiResponse<ModuleDto>.Ok(new ModuleDto
        {
            Id = module.Id,
            Name = module.Name,
            AuditCreate = module.AuditCreate,
            AuditUpdate = module.AuditUpdate,
            AuditDelete = module.AuditDelete
        }));
    }

    [HttpGet("summaries")]
    public async Task<IActionResult> GetModuleSummaries()
    {
        var tenantId = _tenantService.GetCurrentTenantId();
        var modules = await _context.Modules
            .Include(m => m.Fields)
            .Where(m => m.TenantId == tenantId)
            .OrderBy(m => m.Name)
            .ToListAsync();

        var summaries = new List<ModuleSummaryDto>();

        foreach (var module in modules)
        {
            // Simple permission check: if user has any Module.{Name}.* permission OR is Super Admin
            var permissionPrefix = $"Module.{module.Name}.";
            var hasViewPermission = User.HasClaim(c => c.Type == "Permission" && c.Value.StartsWith(permissionPrefix)) ||
                                    User.IsInRole("Super Admin");

            if (!hasViewPermission) continue;

            var latestRecords = await _context.ModuleRecords
                .Where(r => r.ModuleId == module.Id && r.TenantId == tenantId)
                .OrderByDescending(r => r.CreatedAt)
                .Take(5)
                .ToListAsync();

            var recordsData = latestRecords.Select(r => _moduleService.DeserializeData(r.Data)).ToList();
            await EnrichWithDisplayValues(module, latestRecords, recordsData);

            var recordDtos = latestRecords.Select((r, i) =>
            {
                var data = recordsData[i];
                
                // Add __displayValue
                var displayFields = module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
                if (displayFields.Any())
                {
                    var vals = new List<string>();
                    foreach (var df in displayFields)
                    {
                        if (data.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                            vals.Add(dfVal.ToString()!);
                    }
                    if (vals.Any()) data["__displayValue"] = string.Join(" - ", vals);
                }
                else
                {
                    var fallbackField = module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                    if (fallbackField != null && data.TryGetValue(fallbackField.Name, out var val) && val != null)
                        data["__displayValue"] = val.ToString() ?? r.Id.ToString();
                    else
                        data["__displayValue"] = r.Id.ToString();
                }

                return new ModuleRecordDto
                {
                    Id = r.Id,
                    ModuleId = r.ModuleId,
                    Data = data,
                    CreatedAt = r.CreatedAt
                };
            }).ToList();

            summaries.Add(new ModuleSummaryDto
            {
                ModuleId = module.Id,
                ModuleName = module.Name,
                Fields = module.Fields.Select(f => new ModuleFieldDto
                {
                    Id = f.Id,
                    ModuleId = f.ModuleId,
                    Name = f.Name,
                    Label = f.Label,
                    Type = f.Type,
                    IsDisplayField = f.IsDisplayField,
                    OrderNo = f.OrderNo
                }).OrderBy(f => f.OrderNo).ToList(),
                LatestRecords = recordDtos
            });
        }

        return Ok(ApiResponse<List<ModuleSummaryDto>>.Ok(summaries));
    }

    private async Task EnrichWithDisplayValues(Entities.Module module, List<Entities.ModuleRecord> records, List<Dictionary<string, object>> recordsData)
    {
        var relationFields = module.Fields.Where(f => f.Type == "relation" || f.Type == "multiselect-relation").ToList();
        if (!relationFields.Any() || !records.Any()) return;
        
        var targetRecordIds = new Dictionary<string, HashSet<int>>(); 
        
        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    if (!targetRecordIds.ContainsKey(targetModule)) targetRecordIds[targetModule] = new HashSet<int>();
                    
                    if (val is System.Text.Json.JsonElement el)
                    {
                        if (el.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid)) targetRecordIds[targetModule].Add(tid);
                        }
                        else if (el.ValueKind == System.Text.Json.JsonValueKind.Number && el.TryGetInt32(out var tid))
                        {
                            targetRecordIds[targetModule].Add(tid);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid))
                    {
                        targetRecordIds[targetModule].Add(tid);
                    }
                }
            }
        }
        
        var displayValuesMap = new Dictionary<string, Dictionary<int, string>>();
        foreach (var kvp in targetRecordIds)
        {
            var targetModule = kvp.Key;
            var ids = kvp.Value.ToList();
            if (!ids.Any()) continue;
            
            var targetRecords = await _context.ModuleRecords
                .Include(tr => tr.Module)
                .ThenInclude(trM => trM.Fields)
                .Where(tr => tr.Module.Name == targetModule && ids.Contains(tr.Id))
                .ToListAsync();
                
            displayValuesMap[targetModule] = new Dictionary<int, string>();
            foreach (var tr in targetRecords)
            {
                var trData = _moduleService.DeserializeData(tr.Data);
                var displayFields = tr.Module.Fields.Where(f => f.IsDisplayField).OrderBy(f => f.OrderNo).ToList();
                string displayStr = tr.Id.ToString();
                
                if (displayFields.Any())
                {
                    var vals = new List<string>();
                    foreach (var df in displayFields)
                    {
                         if (trData.TryGetValue(df.Name, out var dfVal) && dfVal != null && !string.IsNullOrWhiteSpace(dfVal.ToString()))
                             vals.Add(dfVal.ToString()!);
                    }
                    if (vals.Any()) displayStr = string.Join(" - ", vals);
                }
                else
                {
                     var fallbackField = tr.Module.Fields.OrderBy(f => f.OrderNo).FirstOrDefault(f => f.Type == "text");
                     if (fallbackField != null && trData.TryGetValue(fallbackField.Name, out var val) && val != null)
                         displayStr = val.ToString() ?? tr.Id.ToString();
                }
                
                displayValuesMap[targetModule][tr.Id] = displayStr;
            }
        }

        foreach (var data in recordsData)
        {
            foreach (var field in relationFields)
            {
                if (string.IsNullOrWhiteSpace(field.Options)) continue;
                var targetModule = field.Options.Trim('\"');
                if (!displayValuesMap.ContainsKey(targetModule)) continue;
                
                if (data.TryGetValue(field.Name, out var val) && val != null)
                {
                    var displayStrings = new List<string>();
                    
                    if (val is System.Text.Json.JsonElement el)
                    {
                        if (el.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in el.EnumerateArray())
                                if (item.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid)) 
                                    displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                        else if (el.ValueKind == System.Text.Json.JsonValueKind.Number && el.TryGetInt32(out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                        {
                            displayStrings.Add(displayValuesMap[targetModule][tid]);
                        }
                    }
                    else if (int.TryParse(val.ToString(), out var tid) && displayValuesMap[targetModule].ContainsKey(tid))
                    {
                        displayStrings.Add(displayValuesMap[targetModule][tid]);
                    }
                    
                    if (displayStrings.Any())
                    {
                        data[$"__display_{field.Name}"] = string.Join(", ", displayStrings);
                    }
                }
            }
        }
    }
}
