import api from './api';

/**
 * Sends a chat message to the Copilot backend.
 * @param {string} message - The user message.
 * @param {Array} history - Previous messages [{role, content}].
 * @param {Object} confirmation - Optional confirmation payload.
 * @returns {Promise<Object>} CopilotResponseDto
 */
export const sendCopilotMessage = async (message, history = [], confirmation = null) => {
    const payload = { message, history };

    if (confirmation) {
        payload.pendingActionConfirmed = confirmation.confirmed;
        payload.pendingActionType = confirmation.actionType;
        payload.pendingActionPayload = confirmation.actionPayload;
    }

    const response = await api.post('/copilot/chat', payload);
    return response.data;
};
