import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/NotificationService';
import { useSafeAsync } from './useSafeAsync';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState(notificationService.getPermissionStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  const safeAsync = useSafeAsync();

  const loadNotifications = useCallback(async () => {
    if (!user || isRefreshing) {
      console.log('[useNotifications] No user or already refreshing, skipping load');
      return;
    }

    // Validar que el usuario tenga ID
    if (!user.id) {
      console.error('[useNotifications] User ID is missing, cannot load notifications');
      setError(new Error('User ID missing'));
      return;
    }

    console.log(`[useNotifications] Loading notifications for user ID: ${user.id}`);
    setIsRefreshing(true);
    setLoading(true);
    setError(null); // Clear previous errors
    
    await safeAsync(async () => {
      try {
        // Solo cargar notificaciones no leídas
        const data = await notificationService.getNotifications({ include_read: false });
        const notifsList = Array.isArray(data) ? data : (data?.results || []);
        
        // Log para verificar que las notificaciones pertenecen al usuario correcto
        if (import.meta.env.DEV && notifsList.length > 0) {
          console.log(`[useNotifications] Loaded ${notifsList.length} notifications for user ${user.username} (ID: ${user.id})`);
        }
        
        setNotifications(notifsList);
      } catch (error) {
        console.error('[useNotifications] Error loading notifications:', error);
        setNotifications([]);
        setError(error); // Store error state
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, safeAsync]); // Now include safeAsync

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      console.log('[useNotifications] No user, skipping unread count load');
      return;
    }

    console.log('[useNotifications] Loading unread count...');
    
    await safeAsync(async () => {
      try {
        const count = await notificationService.getUnreadCount();
        setUnreadCount(count);
        console.log('[useNotifications] Unread count loaded:', count);
      } catch (error) {
        console.error('[useNotifications] Error loading unread count:', error);
        console.error('[useNotifications] Error details:', error.message, error.stack);
        setUnreadCount(0);
      }
    });
  }, [user, safeAsync]);

  const requestPermission = useCallback(async () => {
    const newPermission = await notificationService.requestPermission();
    setPermission(newPermission);
    return newPermission;
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    console.log('[useNotifications] Marking notification as read:', notificationId);
    try {
      await notificationService.markAsRead(notificationId);
      // Remove the notification from the list once marked as read
      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
      console.log('[useNotifications] Notification marked as read successfully');
    } catch (error) {
      console.error('[useNotifications] Error marking as read:', error);
      console.error('[useNotifications] Error details:', error.message, error.stack);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    console.log('[useNotifications] Marking all notifications as read');
    try {
      await notificationService.markAllAsRead();
      // Clear all notifications from the list once marked as read
      setNotifications([]);
      setUnreadCount(0);
      console.log('[useNotifications] All notifications marked as read successfully');
    } catch (error) {
      console.error('[useNotifications] Error marking all as read:', error);
      console.error('[useNotifications] Error details:', error.message, error.stack);
    }
  }, []);

  useEffect(() => {
    if (user) {
      console.log('[useNotifications] User detected, initializing notifications');
      loadNotifications();
      loadUnreadCount();
      notificationService.connectWebSocket(user.id);

      const unsubscribe = notificationService.subscribe((data) => {
        // Validar que data existe y tiene la estructura correcta
        if (!data || typeof data !== 'object') {
          console.warn('[useNotifications] Invalid event data received:', data);
          return;
        }

        console.log('[useNotifications] Event received:', data);
        
        // Handle different event types
        if (data.type === 'new_notification' && data.payload) {
          // WebSocket new notification - always refresh
          console.log('[useNotifications] New notification received via WebSocket:', data.payload);
          loadNotifications();
          loadUnreadCount();
        } else if (data.type === 'polling_update' && typeof data.unreadCount === 'number') {
          // Polling update with count - only refresh if count changed
          console.log('[useNotifications] Polling update received with count:', data.unreadCount);
          setUnreadCount(prevCount => {
            // Only refresh notifications list if count actually changed
            if (prevCount !== data.unreadCount) {
              loadNotifications();
            }
            return data.unreadCount;
          });
        } else {
          // Fallback for other events or legacy format
          console.log('[useNotifications] Other event received, refreshing data');
          loadNotifications();
          loadUnreadCount();
        }
      });

      return () => {
        console.log('[useNotifications] Cleaning up WebSocket subscription');
        unsubscribe();
      };
    } else {
      console.log('[useNotifications] No user detected');
    }
  }, [user, loadNotifications, loadUnreadCount]);

  
  return {
    notifications,
    unreadCount,
    loading,
    error, // Expose error state
    permission,
    loadNotifications,
    loadUnreadCount,
    requestPermission,
    markAsRead,
    markAllAsRead,
    refresh: () => {
      loadNotifications();
      loadUnreadCount();
    }
  };
};
