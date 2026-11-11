import React, { useState, useEffect, useCallback } from 'react';
import './PushNotificationToggle.scss';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  sendTestPushNotification,
  syncPushSubscription
} from '../../services/pushNotificationService';
import toast from 'react-hot-toast';

const PushNotificationToggle = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const checkSupport = useCallback(async () => {
    setIsLoading(true);
    try {
      const supported = isPushNotificationSupported();
      setIsSupported(supported);

      if (supported) {
        const currentPermission = getNotificationPermission();
        setPermission(currentPermission);

        if (currentPermission === 'granted') {
          const subscribed = await isPushSubscribed();
          setIsSubscribed(subscribed);
          if (subscribed) {
            // Asegura que el servidor tenga activa la suscripción de este navegador.
            syncPushSubscription().catch((err) => console.warn('No se pudo sincronizar la suscripción push:', err));
          }
        }
      }
    } catch (error) {
      console.error('Error checking notification support:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSupport();
  }, [checkSupport]);

  const handleToggle = async () => {
    if (!isSupported) {
      toast.error('Tu navegador no soporta notificaciones push');
      return;
    }

    setIsLoading(true);

    try {
      if (isSubscribed) {
        // Unsubscribe
        const success = await unsubscribeFromPush();
        if (success) {
          setIsSubscribed(false);
          setPermission('default');
          toast.success('Notificaciones desactivadas');
        } else {
          toast.error('Error al desactivar notificaciones');
        }
      } else {
        // Subscribe
        await subscribeToPush();
        setIsSubscribed(true);
        setPermission('granted');
        toast.success('Notificaciones activadas correctamente');
      }
    } catch (error) {
      console.error('Error toggling push notifications:', error);
      
      if (error.message.includes('denegado')) {
        toast.error('Debes permitir las notificaciones en tu navegador');
        setPermission('denied');
      } else {
        toast.error('Error al cambiar configuración de notificaciones');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      toast.error('Primero debes activar las notificaciones');
      return;
    }

    setIsSending(true);
    try {
      try {
        await sendTestPushNotification();
      } catch (error) {
        // [FIX] Antes cualquier 400 terminaba en "Error al enviar". Ahora,
        // si al servidor le falta la suscripción o el servicio push la
        // rechaza, se vuelve a suscribir este navegador y se reintenta 1 vez.
        const code = error?.response?.data?.code;
        if (code === 'no_subscription') {
          await syncPushSubscription();
        } else if (code === 'resubscribe') {
          await subscribeToPush({ force: true });
        } else {
          throw error;
        }
        await sendTestPushNotification();
      }
      toast.success('Notificación de prueba enviada');
    } catch (error) {
      console.error('Error sending test notification:', error);
      const data = error?.response?.data;
      const detail = data?.failures?.[0]?.status ? ` (servicio push: ${data.failures[0].status})` : '';
      toast.error(`${data?.error || 'Error al enviar notificación de prueba'}${detail}`);
    } finally {
      setIsSending(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="push-notification-toggle unsupported">
        <div className="notification-warning">
          <i className="fas fa-exclamation-triangle"></i>
          <span>Tu navegador no soporta notificaciones push</span>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="push-notification-toggle denied">
        <div className="notification-warning">
          <i className="fas fa-bell-slash"></i>
          <span>Notificaciones bloqueadas. Permite las notificaciones en la configuración de tu navegador.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="push-notification-toggle">
      <div className="toggle-header">
        <div className="toggle-info">
          <i className={`fas fa-bell ${isSubscribed ? 'active' : ''}`}></i>
          <div className="toggle-text">
            <h4>Notificaciones Push</h4>
            <p className="toggle-description">
              {isSubscribed 
                ? 'Recibirás notificaciones en tiempo real' 
                : 'Activa para recibir notificaciones en tiempo real'}
            </p>
          </div>
        </div>
        <div className="toggle-controls">
          <label className="switch">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={handleToggle}
              disabled={isLoading}
            />
            <span className="slider round"></span>
          </label>
          {isSubscribed && (
            <span className="status-badge active">
              <i className="fas fa-check-circle"></i>
              Activo
            </span>
          )}
        </div>
      </div>

      {isSubscribed && (
        <div className="test-notification-section">
          <button
            onClick={handleTestNotification}
            disabled={isSending}
            className="btn-test-notification"
          >
            {isSending ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Enviando...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i>
                Enviar notificación de prueba
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PushNotificationToggle;
