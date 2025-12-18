import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { FiBell, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import './NotificationsList.scss';

const NotificationsList = () => {
  const { notifications, loading, error, markAsRead, refresh } = useNotifications();

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="notifications-list">
        <div className="notifications-loading">
          <div className="loading-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-icon"></div>
                <div className="skeleton-content">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-message"></div>
                  <div className="skeleton-time"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="notifications-list">
        <div className="notifications-error">
          <FiAlertCircle size={48} />
          <h3>Error al cargar notificaciones</h3>
          <p>No se pudieron cargar tus notificaciones. Por favor, intenta de nuevo.</p>
          <button onClick={refresh} className="btn-retry">
            <FiRefreshCw />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (notifications.length === 0) {
    return (
      <div className="notifications-list">
        <div className="notifications-empty">
          <FiBell size={64} />
          <h3>No tienes notificaciones</h3>
          <p>Cuando recibas notificaciones, aparecerán aquí</p>
        </div>
      </div>
    );
  }

  // Notifications list
  return (
    <div className="notifications-list">
      <div className="notifications-items">
        {notifications.map(notification => (
          <NotificationItem 
            key={notification.id} 
            notification={notification}
            onMarkAsRead={markAsRead}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationsList;