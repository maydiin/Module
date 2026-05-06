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
    public DbSet<Tenant> Tenants { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<ModuleScript> ModuleScripts { get; set; }
    public DbSet<ModuleReport> ModuleReports { get; set; }
    public DbSet<ModuleVisibilityRule> ModuleVisibilityRules { get; set; }

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
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Modules)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
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
                
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.ModuleRecords)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);
                
            entity.HasOne(e => e.CreatedByUser)
                .WithMany()
                .HasForeignKey(e => e.CreatedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
            
            entity.HasIndex(e => e.ModuleId);
            entity.HasIndex(e => e.CreatedAt);
            entity.HasIndex(e => e.TenantId);
        });

        modelBuilder.Entity<ModuleVisibilityRule>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Field).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Operator).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Value).HasMaxLength(200);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(20);

            entity.HasOne(e => e.Module)
                .WithMany(m => m.VisibilityRules)
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Role)
                .WithMany()
                .HasForeignKey(e => e.RoleId)
                .OnDelete(DeleteBehavior.SetNull);
                
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.ModuleId });
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
                
            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.TenantId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Username).IsUnique();
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Users)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Roles)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
            
            entity.HasIndex(e => new { e.Name, e.TenantId }).IsUnique();
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            
            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Permissions)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
            
            entity.HasIndex(e => new { e.Name, e.TenantId }).IsUnique();
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

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Subdomain).HasMaxLength(100);
            entity.HasIndex(e => e.IsHost);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Action).IsRequired().HasMaxLength(50);
            entity.Property(e => e.EntityType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.EntityId).HasMaxLength(50);
            entity.Property(e => e.EntityName).HasMaxLength(300);
            entity.Property(e => e.Username).HasMaxLength(100);
            entity.Property(e => e.IpAddress).HasMaxLength(50);
            entity.Property(e => e.Details).HasColumnType("nvarchar(max)");
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.EntityType);
            entity.HasIndex(e => e.Action);
        });

        modelBuilder.Entity<ModuleScript>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TriggerType).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ScriptContent).IsRequired().HasColumnType("nvarchar(max)");
            
            entity.HasOne(e => e.Module)
                .WithMany() // No navigation back from Module needed for now
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);
                
            entity.HasIndex(e => new { e.TenantId, e.ModuleId, e.TriggerType });
        });

        modelBuilder.Entity<ModuleReport>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Type).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Configuration).IsRequired().HasColumnType("nvarchar(max)");

            entity.HasOne(e => e.Module)
                .WithMany()
                .HasForeignKey(e => e.ModuleId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => new { e.TenantId, e.ModuleId });
        });
    }
}

