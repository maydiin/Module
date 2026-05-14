using Microsoft.EntityFrameworkCore;
using Polly;
using Polly.Extensions.Http;
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
using Module.BackgroundServices;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient("default")
    .AddPolicyHandler(GetRetryPolicy());

static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .OrResult(msg => msg.StatusCode == System.Net.HttpStatusCode.NotFound)
        .WaitAndRetryAsync(3, retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
}
builder.Services.AddHttpContextAccessor();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSettings["Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("JWT Key is not configured. Add 'Jwt:Key' to appsettings or environment variables.");

var key = Encoding.ASCII.GetBytes(jwtKey);
var jwtIssuer = jwtSettings["Issuer"] ?? "ModuleApp";
var jwtAudience = jwtSettings["Audience"] ?? "ModuleAppUsers";

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
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ClockSkew = TimeSpan.Zero
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            context.Token = context.Request.Cookies["token"];
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddScoped<IAuthorizationHandler, ModulePermissionAuthorizationHandler>();
// Add a polyfill for dynamic policies if needed, but for now we'll use a dynamic policy provider or simply register policies by name.
// Standard way for dynamic permissions is to use a custom PolicyProvider.
builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
// Add services
builder.Services.AddScoped<IModuleService, ModuleService>();
builder.Services.AddScoped<IRepository, Repository>();
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<IRelationService, RelationService>();
builder.Services.AddScoped<IExternalApiService, ExternalApiService>();
builder.Services.AddScoped<IEmailService, MailtrapEmailService>();
builder.Services.AddScoped<ITenantService, TenantService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddScoped<IApiSyncService, ApiSyncService>();

builder.Services.AddHostedService<PollingBackgroundService>();

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
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000") // Common dev ports
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
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

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors();
app.UseRateLimiter();

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