using Microsoft.EntityFrameworkCore;
using Module.Entities;
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

        // Create sample module: "Tasks"
        var tasksModule = new ModuleEntity
        {
            Name = "Tasks"
        };
        context.Modules.Add(tasksModule);
        await context.SaveChangesAsync();

        // Add fields to Tasks module
        var taskFields = new List<ModuleField>
        {
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "title",
                Label = "Title",
                Type = "text",
                Required = true,
                OrderNo = 1
            },
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "description",
                Label = "Description",
                Type = "text",
                Required = false,
                OrderNo = 2
            },
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "dueDate",
                Label = "Due Date",
                Type = "date",
                Required = false,
                OrderNo = 3
            },
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "completed",
                Label = "Completed",
                Type = "checkbox",
                Required = false,
                OrderNo = 4
            },
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "priority",
                Label = "Priority",
                Type = "number",
                Required = false,
                OrderNo = 5
            },
            new ModuleField
            {
                ModuleId = tasksModule.Id,
                Name = "status",
                Label = "Status",
                Type = "select",
                Options = "[\"Pending\",\"In Progress\",\"Completed\"]",
                Required = false,
                OrderNo = 6
            }
        };
        context.ModuleFields.AddRange(taskFields);
        await context.SaveChangesAsync();

        // Create sample records
        var taskRecords = new List<ModuleRecord>
        {
            new ModuleRecord
            {
                ModuleId = tasksModule.Id,
                Data = """{"title":"Complete API documentation","description":"Write comprehensive API docs","dueDate":"2024-12-31","completed":false,"priority":1}""",
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            },
            new ModuleRecord
            {
                ModuleId = tasksModule.Id,
                Data = """{"title":"Review code changes","description":"Review pull requests","dueDate":"2024-12-15","completed":true,"priority":2}""",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            },
            new ModuleRecord
            {
                ModuleId = tasksModule.Id,
                Data = """{"title":"Setup CI/CD pipeline","description":"Configure automated deployments","dueDate":"2025-01-10","completed":false,"priority":1}""",
                CreatedAt = DateTime.UtcNow
            }
        };
        context.ModuleRecords.AddRange(taskRecords);
        await context.SaveChangesAsync();

        // Create another sample module: "Contacts"
        var contactsModule = new ModuleEntity
        {
            Name = "Contacts"
        };
        context.Modules.Add(contactsModule);
        await context.SaveChangesAsync();

        var contactFields = new List<ModuleField>
        {
            new ModuleField
            {
                ModuleId = contactsModule.Id,
                Name = "firstName",
                Label = "First Name",
                Type = "text",
                Required = true,
                OrderNo = 1
            },
            new ModuleField
            {
                ModuleId = contactsModule.Id,
                Name = "lastName",
                Label = "Last Name",
                Type = "text",
                Required = true,
                OrderNo = 2
            },
            new ModuleField
            {
                ModuleId = contactsModule.Id,
                Name = "email",
                Label = "Email",
                Type = "text",
                Required = false,
                OrderNo = 3
            },
            new ModuleField
            {
                ModuleId = contactsModule.Id,
                Name = "phone",
                Label = "Phone",
                Type = "text",
                Required = false,
                OrderNo = 4
            }
        };
        context.ModuleFields.AddRange(contactFields);
        await context.SaveChangesAsync();

        var contactRecords = new List<ModuleRecord>
        {
            new ModuleRecord
            {
                ModuleId = contactsModule.Id,
                Data = """{"firstName":"John","lastName":"Doe","email":"john.doe@example.com","phone":"555-0101"}""",
                CreatedAt = DateTime.UtcNow.AddDays(-3)
            },
            new ModuleRecord
            {
                ModuleId = contactsModule.Id,
                Data = """{"firstName":"Jane","lastName":"Smith","email":"jane.smith@example.com","phone":"555-0102"}""",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        };
        context.ModuleRecords.AddRange(contactRecords);
        await context.SaveChangesAsync();
    }
}

