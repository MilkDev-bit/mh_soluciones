import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationsList = () => {
  const { notifications, loading, markAsRead } = useNotifications();

  if (loading) return <div>Cargando notificaciones...</div>;

  if (notifications.length === 0) {
    return (
      <div className="notifications-list">
        <div className="empty-state">
          <p>No tienes notificaciones sin leer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-list">
      {notifications.map(notification => (
        <NotificationItem 
          key={notification.id} 
          notification={notification}
          onMarkAsRead={markAsRead}
        />
      ))}
    </div>
  );
};

export default NotificationsList;