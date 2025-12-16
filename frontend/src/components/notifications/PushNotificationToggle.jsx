import React, { useState, useEffect } from 'react';
import './PushNotificationToggle.scss';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  sendTestPushNotification
} from '../../services/pushNotificationService';
import toast from 'react-hot-toast';

const PushNotificationToggle = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = async () => {
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
        }
      }
    } catch (error) {
      console.error('Error verificando soporte de notificaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      await sendTestPushNotification();
      toast.success('Notificación de prueba enviada');
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Error al enviar notificación de prueba');
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
