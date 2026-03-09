namespace Module.Data;

public interface IUnitOfWork : IDisposable
{
    IGenericRepository<Entities.Module> Modules { get; }
    IGenericRepository<Entities.Permission> Permissions { get; }
    IGenericRepository<Entities.Role> Roles { get; }
    IGenericRepository<Entities.RolePermission> RolePermissions { get; }
    IGenericRepository<Entities.UserRole> UserRoles { get; }
    IGenericRepository<Entities.RecordRelation> RecordRelations { get; }
    
    Task<int> CompleteAsync();
}
