import React from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationsList = () => {
  const { notifications, loading, markAsRead } = useNotifications();

  if (loading) return <div>Cargando notificaciones...</div>;

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