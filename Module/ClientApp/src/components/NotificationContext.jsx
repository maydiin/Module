import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import notificationService from '../services/notificationService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connection, setConnection] = useState(null);
  const { user } = useAuth();
  const showToast = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (connection) {
        connection.stop();
        setConnection(null);
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchNotifications();
    
    let isStopped = false;
    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/notifications')
      .withAutomaticReconnect()
      .build();

    newConnection.on('ReceiveNotification', (notification) => {
      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
      
      const type = String(notification.type || 'info').toLowerCase();
      const toastType = type === '1' ? 'success' : type === '2' ? 'warning' : type === '3' ? 'error' : type;
      showToast(notification.message, toastType);
    });

    const start = async () => {
      try {
        await newConnection.start();
        if (isStopped) {
          await newConnection.stop();
        } else {
          console.log('SignalR Connected');
          setConnection(newConnection);
        }
      } catch (err) {
        if (!isStopped) {
          console.error('SignalR Connection Error: ', err);
        }
      }
    };

    start();

    return () => {
      isStopped = true;
      if (newConnection) {
        newConnection.stop().catch(() => {
          // Ignore errors during stop (like already stopped)
        });
      }
    };
  }, [user, fetchNotifications, showToast]);

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead,
      fetchNotifications 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
