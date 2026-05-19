using Module.DTOs;
using Module.Common.Exceptions;

namespace Module.Services.Scripting;

public class ScriptContext
{
    public IScriptDbHelper Db { get; set; }
    public Dictionary<string, object> Data { get; set; }
    public CurrentUserDto User { get; set; }

    
    public void Fail(string message) 
    { 
        throw new ScriptValidationException(message); 
    }
    
    public void Log(string message) 
    {
        Console.WriteLine($"[Script Log] {message}");
    }
}

public class ScriptValidationException : AppException
{
    public ScriptValidationException(string message) : base(message) { }
}

public interface IScriptDbHelper
{
    IScriptModuleHelper Module(string moduleName);
    void RequestApproval(string moduleName, int recordId, string? roleName, string? message, int? timeoutHours = null, string? escalationAction = null, string? escalateToRole = null);
}

public interface IScriptModuleHelper
{
    dynamic? Find(int id);
    void Update(int id, object data);
    // Add other methods like params query
}

public class CurrentUserDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
