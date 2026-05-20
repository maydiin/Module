namespace Module.DTOs.Ai;

/// <summary>
/// Request sent from the frontend Copilot chat widget.
/// </summary>
public class CopilotRequestDto
{
    public string Message { get; set; } = string.Empty;
    public List<CopilotChatMessageDto> History { get; set; } = new();

    // ── Confirmation flow ──
    /// <summary>Set to true when the user clicks "Confirm" on a proposed action.</summary>
    public bool? PendingActionConfirmed { get; set; }
    /// <summary>The action type to execute (e.g. CreateModule, AddRecord).</summary>
    public string? PendingActionType { get; set; }
    /// <summary>The JSON payload for the action.</summary>
    public string? PendingActionPayload { get; set; }
}

/// <summary>
/// A single message in the Copilot chat history.
/// </summary>
public class CopilotChatMessageDto
{
    public string Role { get; set; } = string.Empty; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// Response returned to the frontend Copilot widget.
/// </summary>
public class CopilotResponseDto
{
    public string Text { get; set; } = string.Empty;

    /// <summary>If true, the frontend should show Confirm/Cancel buttons.</summary>
    public bool RequiresConfirmation { get; set; }

    /// <summary>The type of action proposed (CreateModule, AddRecord, DeleteRecord, QueryRecords, CreateReport, None).</summary>
    public string? ActionType { get; set; }

    /// <summary>JSON payload describing the action details. Sent back on confirmation.</summary>
    public string? ActionPayloadJson { get; set; }
}
