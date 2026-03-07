namespace Module.Common.Exceptions;

/// <summary>
/// Base class for all application-level exceptions.
/// Carries an HTTP status code and a user-safe message.
/// </summary>
public class AppException : Exception
{
    public int StatusCode { get; }

    public AppException(string message, int statusCode = 400) : base(message)
    {
        StatusCode = statusCode;
    }
}
