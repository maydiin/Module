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
    }
}

