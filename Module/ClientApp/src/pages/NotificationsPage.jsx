import React, { useState, useEffect } from 'react';
import { useNotifications } from '../components/NotificationContext';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';

const NotificationsPage = () => {
  const { notifications, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const { t } = useTranslation();
  const [filter, setFilter] = useState('all'); // 'all', 'unread'

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => !n.isRead) 
    : notifications;

  const getIconForType = (type) => {
    const typeStr = String(type !== undefined && type !== null ? type : 'info').toLowerCase();
    switch (typeStr) {
      case 'success':
      case '1': return <div className="p-2 rounded-lg bg-success bg-opacity-10 text-success"><Icon name="check" size={20} /></div>;
      case 'error':
      case '3': return <div className="p-2 rounded-lg bg-danger bg-opacity-10 text-danger"><Icon name="alert" size={20} /></div>;
      case 'warning':
      case '2': return <div className="p-2 rounded-lg bg-warning bg-opacity-10 text-warning"><Icon name="alert" size={20} /></div>;
      default: return <div className="p-2 rounded-lg bg-info bg-opacity-10 text-info"><Icon name="info" size={20} /></div>;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h2 className="fw-bold mb-1">{t('notifications', 'Bildirimler')}</h2>
          <p className="text-muted small mb-0">{t('notifications_desc', 'Sistem üzerinden gelen tüm bildirimlerin listesi.')}</p>
        </div>
        <div className="d-flex gap-2">
          <button 
            className="btn btn-blur rounded-pill px-4 fw-bold"
            onClick={markAllAsRead}
          >
            {t('mark_all_read', 'Tümünü Okundu Say')}
          </button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden shadow-premium" style={{ borderRadius: '24px' }}>
        <div className="p-3 border-bottom border-theme-accent d-flex gap-2">
          <button 
            className={`btn rounded-pill px-4 transition-all ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('all')}
          >
            {t('all', 'Tümü')}
          </button>
          <button 
            className={`btn rounded-pill px-4 transition-all ${filter === 'unread' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter('unread')}
          >
            {t('unread', 'Okunmamış')}
          </button>
        </div>

        <div className="notification-page-list">
          {filteredNotifications.length === 0 ? (
            <div className="p-5 text-center">
              <Icon name="bell" size={64} className="opacity-10 mb-3" />
              <h5 className="text-muted">{t('no_notifications', 'Bildirim bulunamadı')}</h5>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 border-bottom border-theme-accent d-flex gap-4 align-items-start transition-all notification-row ${notification.isRead ? '' : 'unread-row'}`}
                onClick={() => !notification.isRead && markAsRead(notification.id)}
                style={{ cursor: 'pointer' }}
              >
                {getIconForType(notification.type)}
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <h5 className={`mb-0 ${notification.isRead ? 'fw-semibold' : 'fw-bold text-primary'}`}>
                      {notification.title}
                    </h5>
                    <span className="small text-muted">{formatDate(notification.createdAt)}</span>
                  </div>
                  <p className="mb-0 text-muted">{notification.message}</p>
                </div>
                {!notification.isRead && (
                   <div className="ms-3 align-self-center">
                     <div className="rounded-circle bg-primary" style={{ width: '10px', height: '10px', boxShadow: '0 0 10px hsla(var(--primary), 0.5)' }}></div>
                   </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        .notification-row:hover {
          background: hsla(var(--foreground), 0.02);
        }
        .unread-row {
          background: hsla(var(--primary), 0.03);
        }
        .unread-row:hover {
          background: hsla(var(--primary), 0.05);
        }
        .btn-ghost {
          background: transparent;
          color: hsl(var(--foreground));
          border: 1px solid transparent;
        }
        .btn-ghost:hover {
          background: hsla(var(--foreground), 0.05);
        }
      `}</style>
    </div>
  );
};

export default NotificationsPage;
