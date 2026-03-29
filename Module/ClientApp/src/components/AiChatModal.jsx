import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

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
    <div className="modal fade show d-block glass-modal" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-centered modal-animate-in">
        <div className="modal-content border-0 shadow-xl overflow-hidden">
          <div className="modal-header modal-header-premium border-0">
            <h5 className="modal-title text-gradient fw-800 fs-4">{title || t('ai_architect_modal_title')}</h5>
            <button type="button" className="btn-close btn-close-premium" onClick={onClose} disabled={aiLoading}></button>
          </div>
          <div className="modal-body p-0 d-flex flex-column" style={{ height: '600px' }}>
            {/* Chat Area */}
            <div className="flex-grow-1 p-4 overflow-auto bg-glass">
              {chatHistory.length === 0 ? (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-40">
                  <div className="bg-primary bg-opacity-10 rounded-circle p-4 mb-4 d-flex align-items-center justify-content-center">
                    <Icon name="sparkles" size={48} className="icon-theme" />
                  </div>
                  <p className="fw-medium">{t('ai_chat_empty_state') || "Describe your requirements to get started."}</p>
                </div>
              ) : (
                chatHistory.map((msg, index) => (
                  <div key={index} className={`d-flex mb-4 ${msg.role === 'user' ? 'justify-content-end' : 'justify-content-start'}`}>
                    <div 
                      className={`p-3 px-4 rounded-4 shadow-sm ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface border-theme-accent border'}`} 
                      style={{ maxWidth: '85%', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}
                    >
                      {msg.role === 'ai' && <div className="fw-extrabold mb-2 small text-primary tracking-wider uppercase">AI</div>}
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {aiLoading && (
                <div className="d-flex mb-4 justify-content-start">
                  <div className="p-3 rounded-4 bg-surface border-theme-accent border shadow-sm">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                  </div>
                </div>
              )}
              {aiPreview && (
                <div className="d-flex mb-4 justify-content-start">
                  <div className="p-4 rounded-4 bg-success bg-opacity-5 border border-success border-opacity-20 w-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                       <h6 className="text-success mb-0 fw-extrabold small tracking-wider uppercase d-flex align-items-center gap-2">
                         <Icon name="sparkles" size={16} /> {t('ai_config_generated')}
                       </h6>
                    </div>
                    <pre className="mb-0 small bg-dark text-light p-3 rounded-3 border-0 shadow-inner" style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '0.8rem' }}>
                      {JSON.stringify(aiPreview, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-glass border-top border-theme-accent">
               <div className="input-group shadow-sm rounded-4 overflow-hidden border border-theme-accent">
                <textarea
                  className="form-control border-0 bg-white"
                  rows="2"
                  placeholder={placeholder || t('ai_prompt_placeholder')}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={aiLoading}
                  style={{ resize: 'none', padding: '1rem' }}
                ></textarea>
                <button 
                  className="btn btn-primary px-4 rounded-0" 
                  type="button" 
                  onClick={handleSend}
                  disabled={aiLoading || !aiPrompt.trim()}
                >
                  <Icon name="sparkles" size={20} color="white" />
                </button>
              </div>
              <div className="d-flex justify-content-end mt-3 gap-3">
                 <button type="button" className="btn btn-blur px-4" onClick={onClose} disabled={aiLoading}>
                   {t('cancel')}
                 </button>
                 {aiPreview && (
                   <button
                     type="button"
                     className="btn btn-success px-4 fw-bold shadow-md hover-lift"
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
