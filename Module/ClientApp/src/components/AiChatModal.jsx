import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function AiChatModal({ show, onClose, onApply, generateAi, title, placeholder }) {
  const { t } = useTranslation();
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (show) {
      setAiPrompt('');
      setAiPreview(null);
      setChatHistory([]);
      setAiLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, aiLoading]);

  if (!show) return null;

  const handleSend = async () => {
    if (!aiPrompt.trim()) return;
    
    const userMessage = { role: 'user', content: aiPrompt };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory);
    setAiPrompt('');
    setAiLoading(true);

    try {
      // Create backend-friendly history format
      const historyForBackend = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content
      }));

      const response = await generateAi(userMessage.content, historyForBackend);
      
      if (response.needsMoreInfo) {
        setChatHistory([...newHistory, { role: 'ai', content: response.message }]);
      } else {
        if (response.message) {
          setChatHistory([...newHistory, { role: 'ai', content: response.message }]);
        }
        setAiPreview(response.configuration);
      }
    } catch (err) {
      alert(t('ai_generate_error') + " " + (err.response?.data || err.message));
      setChatHistory([...newHistory, { role: 'ai', content: t('error_occurred_please_try_again') }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">{title || t('ai_architect_modal_title')}</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose} disabled={aiLoading}></button>
          </div>
          <div className="modal-body p-0 d-flex flex-column" style={{ height: '600px' }}>
            {/* Chat Area */}
            <div className="flex-grow-1 p-3 overflow-auto bg-light">
              {chatHistory.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-50">
                  <span className="fs-1 mb-3">🤖</span>
                  <p>{t('ai_chat_empty_state') || "Describe your requirements to get started."}</p>
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={index} className={`d-flex mb-3 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div 
                      className={`p-3 rounded-4 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-white border'}`} 
                      style={{ maxWidth: '80%', whiteSpace: 'pre-wrap' }}
                    >
                      {msg.role === 'ai' && <div className="fw-bold mb-1 small text-primary">AI</div>}
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {aiLoading && (
                <div className="d-flex mb-3 justify-content-start">
                  <div className="p-3 rounded-4 bg-white border shadow-sm">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                  </div>
                </div>
              )}
              {aiPreview && (
                <div className="d-flex mb-3 justify-content-start">
                  <div className="p-3 rounded-4 bg-success bg-opacity-10 border border-success" style={{ width: '100%' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                       <h6 className="text-success mb-0 fw-bold">{t('ai_config_generated')}</h6>
                    </div>
                    <pre className="mb-0 small bg-white p-2 rounded border" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {JSON.stringify(aiPreview, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-top">
               <div className="input-group">
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder={placeholder || t('ai_prompt_placeholder')}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={aiLoading}
                  style={{ resize: 'none' }}
                ></textarea>
                <button 
                  className="btn btn-primary px-4" 
                  type="button" 
                  onClick={handleSend}
                  disabled={aiLoading || !aiPrompt.trim()}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
              <div className="d-flex justify-content-end mt-2 gap-2">
                 <button type="button" className="btn btn-link text-muted text-decoration-none" onClick={onClose} disabled={aiLoading}>
                   {t('cancel')}
                 </button>
                 {aiPreview && (
                   <button
                     type="button"
                     className="btn btn-success px-4 fw-bold"
                     onClick={() => onApply(aiPreview)}
                     disabled={aiLoading}
                   >
                     {t('ai_apply_changes')}
                   </button>
                 )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiChatModal;
