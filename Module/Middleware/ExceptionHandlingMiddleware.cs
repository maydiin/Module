using System.Net;
using System.Text.Json;
using Module.Common.Exceptions;

namespace Module.Middleware;

/// <summary>
/// Global exception handler middleware.
/// Catches all unhandled exceptions in the pipeline, maps them to HTTP responses
/// with a consistent JSON shape, and prevents internal details from leaking to clients.
/// </summary>
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _env;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = context.TraceIdentifier;
        int statusCode;
        string userMessage;

        switch (exception)
        {
            // ── Custom app exceptions ─────────────────────────────────────────
            case AppException appEx:
                statusCode = appEx.StatusCode;
                userMessage = appEx.Message;
                _logger.LogWarning(appEx, "Application error [{TraceId}]: {Message}", traceId, appEx.Message);
                break;

            // ── BCL exceptions we know are caller errors ──────────────────────
            case KeyNotFoundException keyEx:
                statusCode = (int)HttpStatusCode.NotFound;
                userMessage = keyEx.Message;
                _logger.LogWarning(keyEx, "Not found [{TraceId}]: {Message}", traceId, keyEx.Message);
                break;

            case InvalidOperationException invEx:
                statusCode = (int)HttpStatusCode.BadRequest;
                userMessage = invEx.Message;
                _logger.LogWarning(invEx, "Invalid operation [{TraceId}]: {Message}", traceId, invEx.Message);
                break;

            case UnauthorizedAccessException uaEx:
                statusCode = (int)HttpStatusCode.Unauthorized;
                userMessage = "Bu kaynağa erişim yetkiniz yok.";
                _logger.LogWarning(uaEx, "Unauthorized [{TraceId}]", traceId);
                break;

            // ── External/infrastructure errors ────────────────────────────────
            case HttpRequestException httpEx:
                statusCode = (int)HttpStatusCode.BadGateway;
                userMessage = "Harici bir servis ile iletişim kurulamadı. Lütfen daha sonra tekrar deneyin.";
                _logger.LogError(httpEx, "External HTTP error [{TraceId}]: {Message}", traceId, httpEx.Message);
                break;

            // ── Catch-all: never leak internal details ────────────────────────
            default:
                statusCode = (int)HttpStatusCode.InternalServerError;
                userMessage = "Beklenmedik bir hata oluştu. Lütfen daha sonra tekrar deneyin.";
                _logger.LogError(exception, "Unhandled exception [{TraceId}]: {Message}", traceId, exception.Message);
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var body = new ErrorResponse(userMessage, traceId);

        var json = JsonSerializer.Serialize(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}

/// <summary>
/// Consistent JSON error response shape returned by the middleware.
/// </summary>
internal record ErrorResponse(string Error, string TraceId);
