import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import NotificationsList from '../components/notifications/NotificationsList';

const NotificationsPage = () => {
  const { unreadCount, markAllAsRead } = useNotifications();

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h1>Notificaciones</h1>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-primary">
            Marcar todas como leídas
          </button>
        )}
      </div>
      <NotificationsList />
    </div>
  );
};

export default NotificationsPage;