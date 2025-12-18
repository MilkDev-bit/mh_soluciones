import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

import { AuthContext } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import notificationService from '../../services/NotificationService';

import { FiUser, FiLogOut, FiMenu, FiX, FiChevronDown, FiBell, FiCheck, FiCheckCircle, FiSun, FiMoon } from 'react-icons/fi';
import './Header.scss';

const pageTitles = {
  '/': 'Panel de Control',
  '/projects': 'Salas de Trabajo',
  '/tasks': 'Mis Tareas',
  '/calendar': 'Calendario',
  '/users': 'Usuarios',
  '/profile': 'Mi Perfil',
  '/completed-tasks': 'Tareas Completadas',
  '/hr': 'Recursos Humanos',
  '/admin/users': 'Administración de Usuarios'
};

const Header = ({ onToggleSidebar, sidebarOpen }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [seenNotificationIds, setSeenNotificationIds] = useState(new Set());

  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) return;

    notificationService.connectWebSocket(user.id);

    const unsubscribe = notificationService.subscribe((notificationOrCount) => {
      // Handle both full notification object or simple count update
      if (typeof notificationOrCount === 'object') {
        const newNotification = notificationOrCount;
        
        // Check if we've already seen this notification to prevent duplicates
        setSeenNotificationIds(prevIds => {
          if (prevIds.has(newNotification.id)) {
            // Already seen this notification, don't increment counter
            console.log('[Header] Duplicate notification detected, skipping:', newNotification.id);
            return prevIds;
          }
          
          // New notification - add to list and increment counter
          console.log('[Header] New notification received:', newNotification.id);
          setNotifications(prev => [newNotification, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          toast.info(`🔔 ${newNotification.title}`);
          
          // Add to seen set
          const newSet = new Set(prevIds);
          newSet.add(newNotification.id);
          return newSet;
        });
      }
    });

    const fetchInitialData = async () => {
      try {
        const initialNotifs = await notificationService.getNotifications({ limit: 10 });
        const notifsList = initialNotifs.results || [];
        setNotifications(notifsList);
        
        // Track initial notification IDs as already seen
        const initialIds = new Set(notifsList.map(n => n.id));
        setSeenNotificationIds(initialIds);
        
        const count = await notificationService.getUnreadCount();
        setUnreadCount(count);
        
        console.log('[Header] Initial notifications loaded:', notifsList.length, 'Unread count:', count);
      } catch (error) {
        console.error("[Header] Error loading initial notifications:", error);
      }
    };

    fetchInitialData();

    return () => {
      unsubscribe();
    };
  }, [user]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/projects/') && path.length > '/projects/'.length) {
      return 'Detalle del Proyecto';
    }
    return pageTitles[path] || '';
  };

  const handleLogout = () => {
    setIsProfileOpen(false);
    logout();
  };

  const handleMarkAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Remove from seen set since it's now read
      setSeenNotificationIds(prevIds => {
        const newSet = new Set(prevIds);
        newSet.delete(id);
        return newSet;
      });
      
      console.log('[Header] Notification marked as read:', id);
    } catch (error) {
      console.error("[Header] Error marking notification as read:", error);
      toast.error("No se pudo marcar la notificación.");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      setTimeout(() => {
        setNotifications([]);
        setSeenNotificationIds(new Set());
      }, 500);
      
      console.log('[Header] All notifications marked as read');
    } catch (error) {
      console.error("[Header] Error marking all notifications as read:", error);
      toast.error("No se pudieron marcar las notificaciones.");
    }
  };

  if (!user) return null;

  return (
    <>
      <header className={`main-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <h1 className="header-title">{getPageTitle()}</h1>
        </div>

        <div className="header-right">
          <button
            className="theme-toggle-btn icon-button"
            onClick={toggleTheme}
            title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDarkMode ? <FiSun /> : <FiMoon />}
          </button>

          <div className="notifications-dropdown">
            <button className="icon-button" onClick={() => { setIsNotificationsOpen(prev => !prev); setIsProfileOpen(false); }}>
              <FiBell />
              {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
            </button>

            <div className={`dropdown-panel notifications-panel ${isNotificationsOpen ? 'active' : ''}`}>
              <div className="dropdown-header">
                <h3>Notificaciones</h3>
                {notifications.some(n => !n.is_read) && (
                  <button className="mark-all-read-btn" onClick={handleMarkAllAsRead}>
                    <FiCheckCircle /> Marcar todas como leídas
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="empty-state">No tienes notificaciones.</div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className={`notification-item ${notif.is_read ? 'read' : ''}`}>
                      <div className="notification-content">
                        <p className="title">{notif.title}</p>
                        <p className="message">{notif.message}</p>
                        <span className="time">{formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}</span>
                      </div>
                      {!notif.is_read && (
                        <button className="mark-read-btn" onClick={() => handleMarkAsRead(notif.id)} title="Marcar como leída"><FiCheck /></button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="header-profile">
            <button className="profile-button" onClick={() => { setIsProfileOpen(prev => !prev); setIsNotificationsOpen(false); }}>
              <img src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff`} alt="Avatar" className="profile-avatar" />
              <div className="profile-info">
                <span className="profile-name">{user.first_name} {user.last_name}</span>
                <span className="profile-role">{user.role.replace('_', ' ')}</span>
              </div>
              <FiChevronDown className={`dropdown-icon ${isProfileOpen ? 'open' : ''}`} />
            </button>

            <div className={`dropdown-panel profile-panel ${isProfileOpen ? 'active' : ''}`}>
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  <img
                    src={
                      user.profile_picture ||
                      `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff`
                    }
                    alt="Avatar"
                    className="profile-avatar"
                  />
                </div>
                <div className="dropdown-user-info">
                  <span className="dropdown-name">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="dropdown-email">{user.email}</span>
                </div>
              </div>
              <div className="dropdown-divider"></div>
              <Link to="/profile" onClick={() => setIsProfileOpen(false)} className="dropdown-item"><FiUser /> Mi Perfil</Link>
              <div className="dropdown-divider"></div>
              <button onClick={handleLogout} className="dropdown-item"><FiLogOut /> Cerrar Sesión</button>
            </div>
          </div>
        </div>

        {(isProfileOpen || isNotificationsOpen) && (
          <div className="dropdown-overlay" onClick={() => { setIsProfileOpen(false); setIsNotificationsOpen(false); }} />
        )}
      </header>
      <div className="header-spacer"></div>
    </>
  );
};

export default Header;