using Microsoft.EntityFrameworkCore;
using Module.Data;
using Module.Services;
using Module.FieldTypes;
using Module.FieldTypes.Advanced;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Module.Authorization;
using Module.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var key = Encoding.ASCII.GetBytes(jwtSettings["Key"] ?? "super_secret_key_that_is_at_least_32_characters");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };
});

builder.Services.AddAuthorization();

builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ModulePermissionAuthorizationHandler>();
// Add a polyfill for dynamic policies if needed, but for now we'll use a dynamic policy provider or simply register policies by name.
// Standard way for dynamic permissions is to use a custom PolicyProvider.
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
// Add services
builder.Services.AddScoped<IModuleService, ModuleService>();
builder.Services.AddScoped<IRepository, Repository>();
builder.Services.AddScoped<IRelationService, RelationService>();
builder.Services.AddScoped<IExternalApiService, ExternalApiService>();
builder.Services.AddScoped<IEmailService, MailtrapEmailService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IReportService, ReportService>();

// Scripting Services
builder.Services.AddScoped<Module.Services.Scripting.IScriptDbHelper, Module.Services.Scripting.ScriptDbHelper>();
builder.Services.AddScoped<Module.Services.Scripting.IScriptService, Module.Services.Scripting.JintScriptService>();
builder.Services.AddScoped<Module.Services.Scripting.IScriptApiHelper, Module.Services.Scripting.ScriptApiHelper>();
builder.Services.AddScoped<Module.Services.Ai.IAiModuleSetupService, Module.Services.Ai.AiModuleSetupService>();
builder.Services.AddScoped<Module.Services.Ai.IAiGenerationService, Module.Services.Ai.AiGenerationService>();

// Add Field Types
builder.Services.AddScoped<IFieldType, TextFieldType>();
builder.Services.AddScoped<IFieldType, NumberFieldType>();
builder.Services.AddScoped<IFieldType, DateFieldType>();
builder.Services.AddScoped<IFieldType, DateTimeFieldType>();
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
builder.Services.AddScoped<IFieldType, FormulaFieldType>();

builder.Services.AddScoped<FieldTypeFactory>();

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(Program).Assembly));

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

// Global exception handler — must be first so it wraps the entire pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseHttpsRedirection();
app.UseCors();

// Serve static files
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Fallback to index.html for client-side routing
app.MapFallbackToFile("index.html");

// Apply migrations and seed data
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // Apply pending migrations
    context.Database.Migrate();
    
    // Seed data
    await SeedData.SeedAsync(context);
}

app.Run();