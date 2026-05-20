import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { sendCopilotMessage } from '../../services/copilotService';
import './CopilotWidget.css';

const CopilotWidget = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleToggle = () => setIsOpen(!isOpen);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userText = inputValue;
        const newUserMessage = { role: 'user', content: userText };
        const updatedMessages = [...messages, newUserMessage];

        setMessages(updatedMessages);
        setInputValue('');
        setIsLoading(true);

        try {
            const historyForApi = updatedMessages
                .filter(m => !m.isSystemEvent)
                .map(m => ({ role: m.role, content: m.content }));

            const response = await sendCopilotMessage(userText, historyForApi.slice(0, -1));

            const aiMessage = {
                role: 'assistant',
                content: response.text,
                requiresConfirmation: response.requiresConfirmation,
                actionType: response.actionType,
                actionPayloadJson: response.actionPayloadJson,
            };

            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: t('copilot_error_generic'), isError: true },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleConfirmAction = async (messageIndex, isConfirmed) => {
        const msg = messages[messageIndex];

        // Disable confirmation buttons on the message
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = { ...msg, requiresConfirmation: false, confirmed: isConfirmed };

        const responseLabel = isConfirmed ? t('copilot_user_confirmed') : t('copilot_user_cancelled');
        updatedMessages.push({ role: 'user', content: responseLabel, isSystemEvent: true });
        setMessages(updatedMessages);
        setIsLoading(true);

        try {
            if (isConfirmed) {
                // Send the confirmation to the backend for execution
                const response = await sendCopilotMessage(responseLabel, [], {
                    confirmed: true,
                    actionType: msg.actionType,
                    actionPayload: msg.actionPayloadJson,
                });

                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: response.text },
                ]);
            } else {
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: t('copilot_action_cancelled') },
                ]);
            }
        } catch (error) {
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: t('copilot_action_failed'), isError: true },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (text) => {
        setInputValue(text);
        inputRef.current?.focus();
    };

    const getActionIcon = (actionType) => {
        switch (actionType) {
            case 'CreateModule': return '🧩';
            case 'AddRecord': return '📝';
            case 'DeleteRecord': return '🗑️';
            case 'QueryRecords': return '🔍';
            case 'CreateReport': return '📊';
            default: return '⚙️';
        }
    };

    const getActionLabel = (actionType) => {
        switch (actionType) {
            case 'CreateModule': return t('copilot_action_create_module');
            case 'AddRecord': return t('copilot_action_add_record');
            case 'DeleteRecord': return t('copilot_action_delete_record');
            case 'QueryRecords': return t('copilot_action_query');
            case 'CreateReport': return t('copilot_action_create_report');
            default: return actionType;
        }
    };

    return (
        <div className={`copilot-container ${isOpen ? 'open' : ''}`}>
            {!isOpen && (
                <button className="copilot-toggle-btn" onClick={handleToggle} title="AI Copilot">
                    <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="copilot-badge">AI</span>
                </button>
            )}

            {isOpen && (
                <div className="copilot-window">
                    {/* Header */}
                    <div className="copilot-header">
                        <div className="copilot-title">
                            <span className="copilot-icon">✨</span>
                            <div>
                                <strong>AI Copilot</strong>
                                <span className="copilot-subtitle">{t('copilot_subtitle')}</span>
                            </div>
                        </div>
                        <button className="copilot-close-btn" onClick={handleToggle}>×</button>
                    </div>

                    {/* Messages */}
                    <div className="copilot-messages">
                        {messages.length === 0 && (
                            <div className="copilot-welcome">
                                <div className="copilot-welcome-icon">🤖</div>
                                <h3>{t('copilot_welcome_title')}</h3>
                                <p>{t('copilot_welcome_desc')}</p>
                                <div className="copilot-suggestions">
                                    <button onClick={() => handleSuggestionClick(t('copilot_suggestion_1'))}>
                                        🧩 {t('copilot_suggestion_1')}
                                    </button>
                                    <button onClick={() => handleSuggestionClick(t('copilot_suggestion_2'))}>
                                        📝 {t('copilot_suggestion_2')}
                                    </button>
                                    <button onClick={() => handleSuggestionClick(t('copilot_suggestion_3'))}>
                                        📊 {t('copilot_suggestion_3')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, idx) => (
                            <div key={idx} className={`copilot-message-row ${msg.role} ${msg.isSystemEvent ? 'system-event' : ''}`}>
                                {msg.role === 'assistant' && !msg.isSystemEvent && (
                                    <div className="copilot-avatar">🤖</div>
                                )}
                                <div className={`copilot-bubble ${msg.isError ? 'error' : ''} ${msg.confirmed === true ? 'confirmed' : ''} ${msg.confirmed === false ? 'cancelled' : ''}`}>
                                    <div className="copilot-bubble-text">{msg.content}</div>

                                    {/* Confirmation Card */}
                                    {msg.requiresConfirmation && (
                                        <div className="copilot-confirmation-card">
                                            <div className="copilot-action-badge">
                                                <span>{getActionIcon(msg.actionType)}</span>
                                                <span>{getActionLabel(msg.actionType)}</span>
                                            </div>
                                            <div className="copilot-confirmation-buttons">
                                                <button className="btn-confirm" onClick={() => handleConfirmAction(idx, true)}>
                                                    ✅ {t('copilot_confirm')}
                                                </button>
                                                <button className="btn-cancel" onClick={() => handleConfirmAction(idx, false)}>
                                                    ❌ {t('copilot_cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="copilot-message-row assistant">
                                <div className="copilot-avatar">🤖</div>
                                <div className="copilot-bubble typing-indicator">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="copilot-input-area">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('copilot_input_placeholder')}
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || !inputValue.trim()} className="copilot-send-btn">
                            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CopilotWidget;
