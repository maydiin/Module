using Microsoft.EntityFrameworkCore;
using Module.Entities;
using ModuleEntity = Module.Entities.Module;

namespace Module.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<ModuleEntity> Modules { get; set; }
    public DbSet<ModuleField> ModuleFields { get; set; }
    public DbSet<ModuleRecord> ModuleRecords { get; set; }
    public DbSet<RecordRelation> RecordRelations { get; set; }
    public DbSet<ExternalApiConfig> ExternalApiConfigs { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<UserRole> UserRoles { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }

    [DbFunction("JSON_VALUE", IsBuiltIn = true, IsNullable = true)]
    public static string? JsonValue(string expression, string path) => throw new NotSupportedException();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<RecordRelation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.SourceModule).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TargetModule).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FieldName).IsRequired().HasMaxLength(100);

            entity.HasIndex(e => new { e.SourceModule, e.SourceRecordId });
            entity.HasIndex(e => new { e.TargetModule, e.TargetRecordId });
        });

        modelBuilder.Entity<ModuleEntity>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Name);
        });

        modelBuilder.Entity<ModuleField>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Label).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
            
            entity.HasOne(e => e.Module)
                .WithMany(m => m.Fields)
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(e => new { e.ModuleId, e.Name }).IsUnique();
        });

        modelBuilder.Entity<ModuleRecord>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Data).IsRequired().HasColumnType("nvarchar(max)");
            entity.Property(e => e.CreatedAt).IsRequired();
            
            entity.HasOne(e => e.Module)
                .WithMany(m => m.Records)
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
            
            entity.HasIndex(e => e.ModuleId);
            entity.HasIndex(e => e.CreatedAt);
        });

        modelBuilder.Entity<ExternalApiConfig>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Url).IsRequired();
            entity.Property(e => e.Method).IsRequired().HasMaxLength(10);
            
            entity.HasOne(e => e.Module)
                .WithMany()
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Username).IsUnique();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        modelBuilder.Entity<UserRole>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.RoleId });
            entity.HasOne(e => e.User).WithMany(u => u.UserRoles).HasForeignKey(e => e.UserId);
            entity.HasOne(e => e.Role).WithMany(r => r.UserRoles).HasForeignKey(e => e.RoleId);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.PermissionId });
            entity.HasOne(e => e.Role).WithMany(r => r.RolePermissions).HasForeignKey(e => e.RoleId);
            entity.HasOne(e => e.Permission).WithMany(p => p.RolePermissions).HasForeignKey(e => e.PermissionId);
        });
    }
}

