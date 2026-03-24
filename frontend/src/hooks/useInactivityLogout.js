import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';


const useInactivityLogout = () => {
  const { user, logout } = useAuth();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  
  // 15 minutos de inactividad
  const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos en ms
  const WARNING_TIMEOUT = 14 * 60 * 1000; // Advertencia a los 14 minutos

  const resetTimer = useCallback(() => {
    // Limpiar timeouts existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Solo establecer timer si hay usuario autenticado
    if (user) {
      // Advertencia antes del logout
      warningTimeoutRef.current = setTimeout(() => {
        toast.error('Tu sesión expirará pronto por inactividad. Mueve el mouse para continuar.', {
          duration: 60000, // 1 minuto
        });
      }, WARNING_TIMEOUT);

      // Logout automático
      timeoutRef.current = setTimeout(() => {
        toast.error('Sesión cerrada por inactividad.');
        logout();
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, logout, INACTIVITY_TIMEOUT, WARNING_TIMEOUT]);

  useEffect(() => {
    if (!user) return;

    // Eventos que indican actividad del usuario
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Iniciar timer
    resetTimer();

    // Agregar event listeners
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [user, resetTimer]);

  return null;
};

export default useInactivityLogout;
