using Module.DTOs;

namespace Module.Services;

public interface IModuleService
{
    Task<List<string>> ValidateDataAsync(int moduleId, Dictionary<string, object> data);
    string SerializeData(Dictionary<string, object> data);
    Dictionary<string, object> DeserializeData(string json);
}

