import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';

function ConfirmModal({ 
    show, 
    onClose, 
    onConfirm, 
    title, 
    message, 
    confirmText, 
    cancelText, 
    type = 'danger',
    loading = false 
}) {
    const { t } = useTranslation();

    if (!show) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return 'delete';
            case 'warning': return 'alert';
            default: return 'check';
        }
    };

    const getBtnClass = () => {
        switch (type) {
            case 'danger': return 'btn-danger';
            case 'warning': return 'btn-warning';
            default: return 'btn-primary';
        }
    };

    return createPortal(
        <div className="modal show d-block glass-modal" tabIndex="-1" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-dialog modal-dialog-centered modal-animate-in" style={{ maxWidth: '400px' }}>
                <div className="modal-content border-0 shadow-xl overflow-hidden rounded-4">
                    <div className="modal-header border-0 pb-0 pt-4 px-4 justify-content-center">
                        <div className={`rounded-circle d-flex align-items-center justify-content-center bg-${type} bg-opacity-10 text-${type}`} style={{ width: '64px', height: '64px' }}>
                            <Icon name={getIcon()} size={32} />
                        </div>
                    </div>
                    <div className="modal-body text-center p-4">
                        <h4 className="fw-800 mb-2">{title || t('confirm')}</h4>
                        <p className="text-muted mb-0">{message}</p>
                    </div>
                    <div className="modal-footer border-0 p-4 pt-0 d-flex gap-2">
                        <button 
                            className="btn btn-blur flex-grow-1 py-2 fw-bold" 
                            onClick={onClose}
                            disabled={loading}
                        >
                            {cancelText || t('cancel')}
                        </button>
                        <button 
                            className={`btn ${getBtnClass()} flex-grow-1 py-2 fw-bold shadow-premium hover-lift`}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                            {confirmText || t('confirm')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmModal;
