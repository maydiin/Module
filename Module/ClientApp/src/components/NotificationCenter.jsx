import React, { useState, useRef, useEffect } from 'react';
import { useNotifications } from './NotificationContext';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from './AuthContext';
import SendNotificationModal from './SendNotificationModal';

const NotificationCenter = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { hasPermission } = useAuth();
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  const canSend = hasPermission('Notification.Send');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getIconForType = (type) => {
    const typeStr = String(type !== undefined && type !== null ? type : 'info').toLowerCase();
    switch (typeStr) {
      case 'success':
      case '1': return <Icon name="check" size={16} color="#22c55e" />;
      case 'error':
      case '3': return <Icon name="alert" size={16} color="#ef4444" />;
      case 'warning':
      case '2': return <Icon name="alert" size={16} color="#f59e0b" />;
      case 'info':
      case '0':
      default: return <Icon name="info" size={16} color="#3b82f6" />;
    }
  };

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button 
        className={`notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={t('notifications', 'Bildirimler')}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown glass-panel fade-in">
          <div className="notification-header">
            <h6 className="m-0 fw-bold">{t('notifications', 'Bildirimler')}</h6>
            <div className="notification-header-actions">
              {canSend && (
                <button 
                  className="send-notification-trigger-btn"
                  onClick={() => {
                    setIsSendModalOpen(true);
                    setIsOpen(false);
                  }}
                  title="Bildirim Gönder"
                >
                  <Icon name="api" size={16} />
                </button>
              )}
              {unreadCount > 0 && (
                <button className="mark-all-btn" onClick={markAllAsRead}>
                  {t('mark_all_read', 'Hepsini oku')}
                </button>
              )}
            </div>
          </div>

          <div className="notification-list custom-scrollbar">
            {(!notifications || notifications.length === 0) ? (
              <div className="empty-notifications">
                <Icon name="bell" size={40} className="opacity-20 mb-2" />
                <p className="small text-muted">{t('no_notifications', 'Henüz bildirim yok')}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                  onClick={() => !notification.isRead && markAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {getIconForType(notification.type)}
                  </div>
                  <div className="notification-content">
                    <p className="notification-title">{notification.title}</p>
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">{formatDate(notification.createdAt)}</span>
                  </div>
                  {!notification.isRead && <div className="unread-dot" />}
                </div>
              ))
            )}
          </div>

          <div className="notification-footer">
             <Link 
               to="/notifications" 
               className="view-all-btn w-100 text-center text-decoration-none d-block" 
               onClick={() => setIsOpen(false)}
             >
               {t('view_all', 'Tümünü Gör')}
             </Link>
          </div>
        </div>
      )}
      {isSendModalOpen && (
        <SendNotificationModal 
          isOpen={isSendModalOpen} 
          onClose={() => setIsSendModalOpen(false)} 
        />
      )}
    </div>
  );
};

export default NotificationCenter;
