using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Services;
using Module.FieldTypes;
using Module.FieldTypes.Advanced;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add Entity Framework
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));



// Add services
builder.Services.AddScoped<IModuleService, ModuleService>();
builder.Services.AddScoped<IRepository, Repository>();

// Add Field Types
builder.Services.AddScoped<IFieldType, TextFieldType>();
builder.Services.AddScoped<IFieldType, NumberFieldType>();
builder.Services.AddScoped<IFieldType, DateFieldType>();
builder.Services.AddScoped<IFieldType, CheckboxFieldType>();
builder.Services.AddScoped<IFieldType, SelectFieldType>();

// Advanced Field Types
builder.Services.AddScoped<IFieldType, TextareaFieldType>();
builder.Services.AddScoped<IFieldType, EmailFieldType>();
builder.Services.AddScoped<IFieldType, PhoneFieldType>();
builder.Services.AddScoped<IFieldType, FileFieldType>();
builder.Services.AddScoped<IFieldType, ImageFieldType>();
builder.Services.AddScoped<IFieldType, CurrencyFieldType>();
builder.Services.AddScoped<IFieldType, PercentageFieldType>();
builder.Services.AddScoped<IFieldType, MultiSelectFieldType>();
builder.Services.AddScoped<IFieldType, RichTextFieldType>();
builder.Services.AddScoped<IFieldType, JsonFieldType>();
builder.Services.AddScoped<IFieldType, RelationFieldType>();

builder.Services.AddScoped<FieldTypeFactory>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors();

// Serve static files
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();

// Fallback to index.html for client-side routing
app.MapFallbackToFile("index.html");

// Ensure database is created and seeded
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // In development, we can ensure the database is updated by deleting and recreating it
    // WARNING: This deletes all data. In production, use migrations.
    if (app.Environment.IsDevelopment())
    {
        // Uncomment the line below if you want to force recreation on every start
        //context.Database.EnsureDeleted();
    }
    
    context.Database.EnsureCreated();
    
    // Seed data
    await SeedData.SeedAsync(context);
}

app.Run();