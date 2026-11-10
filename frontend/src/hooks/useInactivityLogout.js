import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// 15 minutos sin actividad en NINGUNA pestaña de la app.
const INACTIVITY_TIMEOUT = 15 * 60 * 1000;
const WARNING_BEFORE = 60 * 1000; // aviso 1 minuto antes
const CHECK_EVERY = 15 * 1000;
const STORAGE_KEY = 'mh_last_activity';
const WARNING_TOAST_ID = 'inactivity-warning';

const readLastActivity = () => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
};

const writeLastActivity = (ts) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    /* modo privado / storage lleno: se usa solo el valor en memoria */
  }
};

/**
 * Cierra la sesión tras 15 min de inactividad.
 *
 * [FIX] Antes cada pestaña llevaba su propio contador con los eventos de esa
 * pestaña. Si tenías la app abierta en dos pestañas y trabajabas en una, la
 * otra "se aburría" a los 15 min, llamaba a /auth/logout/ (que borra las
 * cookies para TODO el navegador) y la sesión se cerraba en la pestaña donde
 * sí estabas trabajando. Ahora la última actividad se comparte entre
 * pestañas (localStorage) y solo se cierra si NINGUNA tuvo actividad.
 * Volver a la pestaña o darle foco también cuenta como actividad.
 */
const useInactivityLogout = () => {
  const { user, logout } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const lastWriteRef = useRef(0);
  const warnedRef = useRef(false);
  const loggingOutRef = useRef(false);

  const markActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (warnedRef.current) {
      toast.dismiss(WARNING_TOAST_ID);
      warnedRef.current = false;
    }
    // mousemove dispara cientos de eventos: se escribe como máximo cada 5 s.
    if (now - lastWriteRef.current > 5000) {
      lastWriteRef.current = now;
      writeLastActivity(now);
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    loggingOutRef.current = false;
    markActivity();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach((event) => document.addEventListener(event, markActivity, { passive: true }));
    const onVisible = () => { if (document.visibilityState === 'visible') markActivity(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', markActivity);

    // Actividad en otra pestaña
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        lastActivityRef.current = Math.max(lastActivityRef.current, Number(e.newValue) || 0);
        if (warnedRef.current) {
          toast.dismiss(WARNING_TOAST_ID);
          warnedRef.current = false;
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const interval = setInterval(() => {
      const last = Math.max(lastActivityRef.current, readLastActivity());
      const idle = Date.now() - last;

      if (idle >= INACTIVITY_TIMEOUT) {
        if (loggingOutRef.current) return;
        loggingOutRef.current = true;
        toast.dismiss(WARNING_TOAST_ID);
        toast.error('Sesión cerrada por inactividad.');
        logout();
      } else if (idle >= INACTIVITY_TIMEOUT - WARNING_BEFORE && !warnedRef.current) {
        warnedRef.current = true;
        toast.error('Tu sesión se cerrará en 1 minuto por inactividad. Mueve el mouse para continuar.', {
          id: WARNING_TOAST_ID,
          duration: WARNING_BEFORE,
        });
      }
    }, CHECK_EVERY);

    return () => {
      clearInterval(interval);
      events.forEach((event) => document.removeEventListener(event, markActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', markActivity);
      window.removeEventListener('storage', onStorage);
    };
  }, [user, logout, markActivity]);

  return null;
};

export default useInactivityLogout;
