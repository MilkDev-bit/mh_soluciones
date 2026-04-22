import React, { createContext, useState, useEffect, useContext } from 'react';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Si el usuario guardó una preferencia manual, usarla
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme !== null) {
      return savedTheme === 'dark';
    }
    // Sin preferencia manual: seguir el tema del navegador/SO
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
    // NO guardamos en localStorage aquí; solo se guarda al hacer toggle manual
  }, [isDarkMode]);

  // Seguir cambios del tema del sistema si el usuario no ha elegido manualmente
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      // Solo seguir el sistema si no hay preferencia manual guardada
      if (localStorage.getItem('theme') === null) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      // Guardar en localStorage solo cuando el usuario cambia manualmente
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeProvider;
