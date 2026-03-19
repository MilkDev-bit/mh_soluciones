import { useNavigate } from 'react-router-dom';
import { 
  FiCheckSquare, 
  FiAlertCircle, 
  FiBell,
  FiCalendar,
  FiUsers,
  FiMessageSquare,
  FiFolder,
  FiUpload,
  FiEdit,
  FiClock
} from 'react-icons/fi';
import './NotificationItem.scss';

const NotificationItem = ({ notification, onMarkAsRead }) => {
  const navigate = useNavigate();
  const getNotificationConfig = (type) => {
    const configs = {
      'TASK_ASSIGNED': { icon: FiCheckSquare, color: '#4CAF50', label: 'Tarea' },
      'TASK_DUE': { icon: FiClock, color: '#FF9800', label: 'Vencimiento' },
      'TASK_OVERDUE': { icon: FiAlertCircle, color: '#F44336', label: 'Atrasada' },
      'TASK_COMPLETED': { icon: FiCheckSquare, color: '#2196F3', label: 'Completada' },
      'FILE_UPLOADED': { icon: FiUpload, color: '#9C27B0', label: 'Archivo' },
      'COMMENT_REPLY': { icon: FiMessageSquare, color: '#00BCD4', label: 'Comentario' },
      'CALENDAR_EVENT': { icon: FiCalendar, color: '#FF5722', label: 'Evento' },
      'EVENT_REMINDER': { icon: FiClock, color: '#FF9800', label: 'Recordatorio' },
      'TEAM_INVITATION': { icon: FiUsers, color: '#3F51B5', label: 'Equipo' },
      'PROJECT_UPDATE': { icon: FiFolder, color: '#607D8B', label: 'Proyecto' },
      'MENTION': { icon: FiMessageSquare, color: '#E91E63', label: 'Mención' },
      'ROLE_CHANGE': { icon: FiEdit, color: '#795548', label: 'Rol' },
      'INFO': { icon: FiBell, color: '#9E9E9E', label: 'Info' },
    };
    return configs[type] || configs['INFO'];
  };

  // Format timestamp to relative time
  const formatRelativeTime = (timestamp) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Justo ahora';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `Hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
    }
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `Hace ${days} día${days !== 1 ? 's' : ''}`;
    }
    
    // For older notifications, show the date
    return date.toLocaleDateString('es-MX', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const config = getNotificationConfig(notification.notification_type);
  const IconComponent = config.icon;
  const relativeTime = formatRelativeTime(notification.created_at);

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div 
      className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${notification.title}. ${notification.is_read ? 'Leída' : 'No leída'}. Clic para marcar como leída.`}
    >
      {/* Icon with colored background */}
      <div className="notification-icon" style={{ backgroundColor: config.color }}>
        <IconComponent size={20} />
      </div>

      {/* Content */}
      <div className="notification-content">
        <div className="notification-header">
          <span className="notification-title">{notification.title}</span>
          <span className="notification-type-badge" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
        
        <div className="notification-message">{notification.message}</div>
        
        <div className="notification-footer">
          <span className="notification-time">
            <FiClock size={12} />
            {relativeTime}
          </span>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && <div className="unread-indicator"></div>}
    </div>
  );
};

export default NotificationItem;