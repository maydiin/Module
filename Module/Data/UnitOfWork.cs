namespace Module.Data;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    
    public IGenericRepository<Entities.Module> Modules { get; private set; }
    public IGenericRepository<Entities.Permission> Permissions { get; private set; }
    public IGenericRepository<Entities.Role> Roles { get; private set; }
    public IGenericRepository<Entities.RolePermission> RolePermissions { get; private set; }
    public IGenericRepository<Entities.UserRole> UserRoles { get; private set; }
    public IGenericRepository<Entities.RecordRelation> RecordRelations { get; private set; }

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Modules = new GenericRepository<Entities.Module>(_context);
        Permissions = new GenericRepository<Entities.Permission>(_context);
        Roles = new GenericRepository<Entities.Role>(_context);
        RolePermissions = new GenericRepository<Entities.RolePermission>(_context);
        UserRoles = new GenericRepository<Entities.UserRole>(_context);
        RecordRelations = new GenericRepository<Entities.RecordRelation>(_context);
    }

    public async Task<int> CompleteAsync()
    {
        return await _context.SaveChangesAsync();
    }

    public void Dispose()
    {
        _context.Dispose();
    }
}
