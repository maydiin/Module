using Module.Entities;

namespace Module.Services.Scripting;

public interface IScriptApiHelper
{
    Task<object> ExecuteAsync(int moduleId, string configName, Dictionary<string, object> parameters);
}
