// Componente individual para cada notificación
import React from 'react';
import { FiCheckSquare, FiAlertCircle, FiBell } from 'react-icons/fi';

const NotificationItem = ({ notification, onMarkAsRead }) => {
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TASK_ASSIGNED': return <FiCheckSquare className="icon-task" />;
      case 'PROJECT_UPDATE': return <FiAlertCircle className="icon-project" />;
      default: return <FiBell className="icon-info" />;
    }
  };

  return (
    <div 
      className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
      onClick={() => onMarkAsRead(notification.id)}
    >
      <div className="notification-icon">
        {getNotificationIcon(notification.notification_type)}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
        <div className="notification-time">
          {new Date(notification.created_at).toLocaleDateString()}
        </div>
      </div>
      {!notification.is_read && <div className="unread-dot"></div>}
    </div>
  );
};

export default NotificationItem;