namespace Module.Common.Exceptions;

/// <summary>
/// Thrown when a requested resource cannot be found. Maps to HTTP 404.
/// </summary>
public class NotFoundException : AppException
{
    public NotFoundException(string message = "Kaynak bulunamadı.") : base(message, 404) { }
}
