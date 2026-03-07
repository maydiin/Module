namespace Module.Common.Exceptions;

/// <summary>
/// Thrown when input validation fails. Maps to HTTP 400.
/// </summary>
public class ValidationException : AppException
{
    public ValidationException(string message) : base(message, 400) { }
}
