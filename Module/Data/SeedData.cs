using Microsoft.EntityFrameworkCore;
using Module.Entities;
using System.Text.Json;
using ModuleEntity = Module.Entities.Module;

namespace Module.Data;

public static class SeedData
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (await context.Modules.AnyAsync())
        {
            return; // Database already seeded
        }

        // --- PDKS Seeding ---

        // 1. Kurum (Institution)
        var kurumModule = new ModuleEntity { Name = "Kurum" };
        context.Modules.Add(kurumModule);
        await context.SaveChangesAsync();

        var kurumFields = new List<ModuleField>
        {
            new ModuleField { ModuleId = kurumModule.Id, Name = "name", Label = "Kurum Adı", Type = "text", Required = true, OrderNo = 1 },
            new ModuleField { ModuleId = kurumModule.Id, Name = "address", Label = "Adres", Type = "textarea", Required = false, OrderNo = 2 },
            new ModuleField { ModuleId = kurumModule.Id, Name = "taxNo", Label = "Vergi No", Type = "text", Required = false, OrderNo = 3 }
        };
        context.ModuleFields.AddRange(kurumFields);
        await context.SaveChangesAsync();

        var kurumRecords = new List<ModuleRecord>
        {
            new ModuleRecord { ModuleId = kurumModule.Id, Data = """{"name":"Antigravity Teknoloji","address":"Kocaeli Teknopark","taxNo":"1234567890"}""", CreatedAt = DateTime.UtcNow }
        };
        context.ModuleRecords.AddRange(kurumRecords);
        await context.SaveChangesAsync();

        // 2. Şube (Branch)
        var subeModule = new ModuleEntity { Name = "Şube" };
        context.Modules.Add(subeModule);
        await context.SaveChangesAsync();

        var subeFields = new List<ModuleField>
        {
            new ModuleField { ModuleId = subeModule.Id, Name = "name", Label = "Şube Adı", Type = "text", Required = true, OrderNo = 1 },
            new ModuleField { ModuleId = subeModule.Id, Name = "kurum", Label = "Bağlı Kurum", Type = "relation", Options = "\"Kurum\"", Required = true, OrderNo = 2 },
            new ModuleField { ModuleId = subeModule.Id, Name = "city", Label = "Şehir", Type = "text", Required = false, OrderNo = 3 }
        };
        context.ModuleFields.AddRange(subeFields);
        await context.SaveChangesAsync();

        var subeRecords = new List<ModuleRecord>
        {
            new ModuleRecord { ModuleId = subeModule.Id, Data = $$"""{"name":"Kocaeli Arge Şubesi","kurum":{{kurumRecords[0].Id}},"city":"Kocaeli"}""", CreatedAt = DateTime.UtcNow }
        };
        context.ModuleRecords.AddRange(subeRecords);
        await context.SaveChangesAsync();

        // 3. Kişi (Person)
        var kisiModule = new ModuleEntity { Name = "Kişi" };
        context.Modules.Add(kisiModule);
        await context.SaveChangesAsync();

        var kisiFields = new List<ModuleField>
        {
            new ModuleField { ModuleId = kisiModule.Id, Name = "firstName", Label = "Ad", Type = "text", Required = true, OrderNo = 1 },
            new ModuleField { ModuleId = kisiModule.Id, Name = "lastName", Label = "Soyad", Type = "text", Required = true, OrderNo = 2 },
            new ModuleField { ModuleId = kisiModule.Id, Name = "tcNo", Label = "TC Kimlik No", Type = "text", Required = true, OrderNo = 3 },
            new ModuleField { ModuleId = kisiModule.Id, Name = "sube", Label = "Şube", Type = "relation", Options = "\"Şube\"", Required = true, OrderNo = 4 },
            new ModuleField { ModuleId = kisiModule.Id, Name = "sicilNo", Label = "Sicil No", Type = "text", Required = false, OrderNo = 5 }
        };
        context.ModuleFields.AddRange(kisiFields);
        await context.SaveChangesAsync();

        var kisiRecords = new List<ModuleRecord>
        {
            new ModuleRecord { ModuleId = kisiModule.Id, Data = $$"""{"firstName":"Mustafa","lastName":"Aydın","tcNo":"11122233344","sube":{{subeRecords[0].Id}},"sicilNo":"P001"}""", CreatedAt = DateTime.UtcNow }
        };
        context.ModuleRecords.AddRange(kisiRecords);
        await context.SaveChangesAsync();

        // 4. Giriş-Çıkış (Entry-Exit)
        var entryExitModule = new ModuleEntity { Name = "Giriş-Çıkış" };
        context.Modules.Add(entryExitModule);
        await context.SaveChangesAsync();

        var entryExitFields = new List<ModuleField>
        {
            new ModuleField { ModuleId = entryExitModule.Id, Name = "person", Label = "Personel", Type = "relation", Options = "\"Kişi\"", Required = true, OrderNo = 1 },
            new ModuleField { ModuleId = entryExitModule.Id, Name = "type", Label = "İşlem Türü", Type = "select", Options = "[\"Giriş\",\"Çıkış\"]", Required = true, OrderNo = 2 },
            new ModuleField { ModuleId = entryExitModule.Id, Name = "timestamp", Label = "Zaman", Type = "datetime", Required = true, OrderNo = 3 },
            new ModuleField { ModuleId = entryExitModule.Id, Name = "location", Label = "Konum", Type = "text", Required = false, OrderNo = 4 }
        };
        context.ModuleFields.AddRange(entryExitFields);
        await context.SaveChangesAsync();

        var entryExitRecords = new List<ModuleRecord>
        {
            new ModuleRecord 
            { 
                ModuleId = entryExitModule.Id, 
                Data = $$"""{"person":{{kisiRecords[0].Id}},"type":"Giriş","timestamp":"{{DateTime.UtcNow:yyyy-MM-ddTHH:mm:ss}}","location":"Ana Kapı"}""", 
                CreatedAt = DateTime.UtcNow 
            },
            new ModuleRecord 
            { 
                ModuleId = entryExitModule.Id, 
                Data = $$"""{"person":{{kisiRecords[0].Id}},"type":"Çıkış","timestamp":"{{DateTime.UtcNow.AddHours(8):yyyy-MM-ddTHH:mm:ss}}","location":"Ana Kapı"}""", 
                CreatedAt = DateTime.UtcNow 
            }
        };
        context.ModuleRecords.AddRange(entryExitRecords);
        await context.SaveChangesAsync();

        // --- RecordRelations Seeding ---
        // These are necessary for the reverse relations system to show linked record counts
        
        var relations = new List<RecordRelation>
        {
            // Şube -> Kurum
            new RecordRelation 
            { 
                SourceModule = "Şube", SourceRecordId = subeRecords[0].Id, 
                TargetModule = "Kurum", TargetRecordId = kurumRecords[0].Id, 
                FieldName = "kurum" 
            },
            // Kişi -> Şube
            new RecordRelation 
            { 
                SourceModule = "Kişi", SourceRecordId = kisiRecords[0].Id, 
                TargetModule = "Şube", TargetRecordId = subeRecords[0].Id, 
                FieldName = "sube" 
            },
            // Giriş-Çıkış -> Kişi
            new RecordRelation 
            { 
                SourceModule = "Giriş-Çıkış", SourceRecordId = entryExitRecords[0].Id, 
                TargetModule = "Kişi", TargetRecordId = kisiRecords[0].Id, 
                FieldName = "person" 
            },
            new RecordRelation 
            { 
                SourceModule = "Giriş-Çıkış", SourceRecordId = entryExitRecords[1].Id, 
                TargetModule = "Kişi", TargetRecordId = kisiRecords[0].Id, 
                FieldName = "person" 
            }
        };
        
        context.RecordRelations.AddRange(relations);
        await context.SaveChangesAsync();

        // --- External API Configurations Seed ---

        var syncConfig = new ExternalApiConfig
        {
            ModuleId = entryExitModule.Id,
            Name = "Dış Kapı Turnike Senkronizasyon",
            Url = "https://mockapi.io/api/v1/attendance", // Example URL
            Method = "GET",
            ResponseMappingsJson = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                { "__root__", "data" }, // Array is under "data" property
                { "emp_id", "person" },
                { "direction", "type" },
                { "event_time", "timestamp" },
                { "gate_name", "location" }
            })
        };

        context.ExternalApiConfigs.Add(syncConfig);
        await context.SaveChangesAsync();
    }
}

