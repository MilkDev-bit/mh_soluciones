import React from 'react';
import { Toaster } from 'react-hot-toast';

/**
 * ToastNotification component - Wrapper para react-hot-toast
 * Configuración centralizada para todas las notificaciones del sistema
 */
const ToastNotification = () => {
  return (
    <Toaster
      position="top-right"
      reverseOrder={false}
      gutter={8}
      containerClassName="toast-container"
      containerStyle={{
        top: 80,
        right: 20,
      }}
      toastOptions={{
        // Configuración por defecto para todos los toast
        className: 'toast-notification',
        duration: 4000,
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
          maxWidth: '500px',
          fontSize: '0.9375rem',
          fontWeight: '500',
        },
        // Configuración específica por tipo
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#198754',
            secondary: '#fff',
          },
          style: {
            borderLeft: '4px solid #198754',
          },
        },
        error: {
          duration: 5000,
          iconTheme: {
            primary: '#dc3545',
            secondary: '#fff',
          },
          style: {
            borderLeft: '4px solid #dc3545',
          },
        },
        loading: {
          duration: Infinity,
          iconTheme: {
            primary: '#3b82f6',
            secondary: '#fff',
          },
          style: {
            borderLeft: '4px solid #3b82f6',
          },
        },
        custom: {
          duration: 4000,
        },
      }}
    />
  );
};

// Funciones de utilidad para mostrar notificaciones
export const showToast = {
  success: (message, options = {}) => {
    return toast.success(message, {
      ...options,
      className: 'toast-success',
    });
  },
  
  error: (message, options = {}) => {
    return toast.error(message, {
      ...options,
      className: 'toast-error',
    });
  },
  
  loading: (message, options = {}) => {
    return toast.loading(message, {
      ...options,
      className: 'toast-loading',
    });
  },
  
  promise: (promise, messages = {}, options = {}) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Cargando...',
        success: messages.success || '¡Éxito!',
        error: messages.error || 'Error al procesar la solicitud',
      },
      options
    );
  },
  
  custom: (message, options = {}) => {
    return toast(message, {
      ...options,
      className: 'toast-custom',
    });
  },
  
  dismiss: (toastId) => {
    toast.dismiss(toastId);
  },
  
  dismissAll: () => {
    toast.dismiss();
  },
};

export default ToastNotification;
