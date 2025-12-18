import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/NotificationService';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState(notificationService.getPermissionStatus());
  const { user } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!user) {
      console.log('[useNotifications] No user, skipping load');
      return;
    }

    console.log('[useNotifications] Loading notifications...');
    setLoading(true);
    setError(null); // Clear previous errors
    try {
      // Only load unread notifications
      const data = await notificationService.getNotifications({ include_read: false });
      // NotificationService.getNotifications handles both paginated and non-paginated responses
      // and ensures it always returns an array. Extra check for defensive programming.
      const notifsList = Array.isArray(data) ? data : [];
      setNotifications(notifsList);
      console.log('[useNotifications] Notifications loaded successfully:', notifsList.length);
    } catch (error) {
      console.error('[useNotifications] Error loading notifications:', error);
      console.error('[useNotifications] Error details:', error.message, error.stack);
      setNotifications([]);
      setError(error); // Store error state
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadUnreadCount = useCallback(async () => {
    if (!user) {
      console.log('[useNotifications] No user, skipping unread count load');
      return;
    }

    console.log('[useNotifications] Loading unread count...');
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
      console.log('[useNotifications] Unread count loaded:', count);
    } catch (error) {
      console.error('[useNotifications] Error loading unread count:', error);
      console.error('[useNotifications] Error details:', error.message, error.stack);
      setUnreadCount(0);
    }
  }, [user]);

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
