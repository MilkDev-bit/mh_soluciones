import React, { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import NotificationsList from '../components/notifications/NotificationsList';
import { FiBell, FiCheckCircle, FiRefreshCw, FiFilter } from 'react-icons/fi';
import './NotificationsPage.scss';

const NotificationsPage = () => {
  const { unreadCount, markAllAsRead, refresh, loading } = useNotifications();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    setIsMarkingAllRead(true);
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="notifications-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <FiBell className="header-icon" />
            <h1>Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount}</span>
            )}
          </div>
          <p className="header-subtitle">
            Mantente al día con todas tus actualizaciones
          </p>
        </div>

        {/* Action buttons */}
        <div className="header-actions">
          <button 
            onClick={refresh} 
            className="btn-action btn-refresh"
            disabled={loading}
            aria-label="Actualizar notificaciones"
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
            <span className="btn-text">Actualizar</span>
          </button>
          
          {unreadCount > 0 && (
            <button 
              onClick={handleMarkAllAsRead}
              className="btn-action btn-mark-all"
              disabled={isMarkingAllRead}
              aria-label="Marcar todas como leídas"
            >
              <FiCheckCircle />
              <span className="btn-text">Marcar todas como leídas</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      <div className="notifications-container">
        <NotificationsList />
      </div>
    </div>
  );
};

export default NotificationsPage;
