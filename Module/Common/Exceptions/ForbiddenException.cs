namespace Module.Common.Exceptions;

/// <summary>
/// Thrown when the caller lacks permission to perform an operation. Maps to HTTP 403.
/// </summary>
public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "Bu işlemi yapmaya yetkiniz yok.") : base(message, 403) { }
}
