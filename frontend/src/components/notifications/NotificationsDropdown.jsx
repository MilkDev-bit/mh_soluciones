import React, { useState, useRef, useEffect } from 'react';
import { FiBell, FiCheck } from 'react-icons/fi';
import { useNotifications } from '../../hooks/useNotifications';
import './NotificationsDropdown.scss';

const NotificationsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { unreadCount, loading, markAllAsRead } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="notifications-dropdown" ref={dropdownRef}>
      <button 
        className={`notifications-button ${isOpen ? 'active' : ''}`}
        onClick={handleToggle}
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Notificaciones</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-read"
                onClick={markAllAsRead}
                disabled={loading}
              >
                <FiCheck /> Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="notifications-list">
            <div className="empty-state">
              <FiBell />
              <p>Sistema de notificaciones activo</p>
              <small>{unreadCount} no leídas</small>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsDropdown;