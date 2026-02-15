using Module.DTOs.Ai;

namespace Module.Services.Ai;

public interface IAiModuleSetupService
{
    Task ApplyConfigAsync(AiSystemConfigDto config);
}
