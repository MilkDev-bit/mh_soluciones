import { createContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

export const LayoutContext = createContext();

// Igual que las reglas `@media (max-width: $breakpoint-lg)` (1024 px) de
// Sidebar.scss: hasta 1024 px el menú es un cajón que se abre con el botón
// flotante; desde 1025 px es la barra fija (normal o plegada).
const DESKTOP_QUERY = '(min-width: 1025px)';
const COLLAPSED_KEY = 'mh_sidebar_collapsed';

const readCollapsedPref = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const useIsDesktop = () => {
  const getMatch = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(DESKTOP_QUERY).matches
      : true;
  const [isDesktop, setIsDesktop] = useState(getMatch);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);

  return isDesktop;
};

export const LayoutProvider = ({ children }) => {
  // Preferencia del usuario (se recuerda entre visitas).
  const [collapsedPref, setCollapsedPref] = useState(readCollapsedPref);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isDesktop = useIsDesktop();

  // [FIX] El modo "plegado" (70 px, solo íconos) solo existe en escritorio.
  // Antes, si se plegaba el menú y luego la pantalla era chica, el cajón
  // móvil se abría con la animación y al terminar volvía a quedar oculto
  // (las reglas de "plegado" lo empujaban fuera de la pantalla): "abre un
  // segundo y se cierra".
  const isSidebarCollapsed = collapsedPref && isDesktop;

  const setIsSidebarCollapsed = useCallback((value) => {
    setCollapsedPref((prev) => {
      const next = typeof value === 'function' ? value(prev) : Boolean(value);
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* sin storage: solo dura la sesión */
      }
      return next;
    });
  }, []);

  // Al pasar a escritorio el cajón móvil no aplica.
  useEffect(() => {
    if (isDesktop) setIsSidebarOpen(false);
  }, [isDesktop]);

  return (
    <LayoutContext.Provider
      value={{
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isSidebarOpen,
        setIsSidebarOpen,
        isDesktop,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

LayoutProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
