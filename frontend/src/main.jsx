import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProjectProvider } from './contexts/ProjectContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { LayoutProvider } from './contexts/LayoutContext.jsx';
import './assets/styles/main.scss';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App lista para trabajar offline');
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data remains fresh
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4) - cache retention
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch on tab focus
      refetchOnReconnect: false, // Prevent refetch on reconnect
      refetchOnMount: false, // Use cache if available
    },
    mutations: {
      retry: 1,
    },
  },
});

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    // Registramos tu SW de notificaciones SOLO si no hay conflictos
    navigator.serviceWorker.register('/custom-sw.js', { scope: '/' })
      .then((reg) => console.log('Push SW registrado'))
      .catch((err) => console.error('Error en Push SW', err));
  });
}

const rootElement = document.getElementById('root');
const app = (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <LayoutProvider>
              <ProjectProvider> 
                <App />
                <Toaster 
                  position="top-right" 
                  toastOptions={{ 
                    duration: 4000,
                    style: {
                      background: '#333',
                      color: '#fff',
                    }
                  }} 
                />
              </ProjectProvider>
            </LayoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
    {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
  </QueryClientProvider>
);

// Conditionally wrap with StrictMode only in development
if (import.meta.env.DEV) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>{app}</React.StrictMode>
  );
} else {
  ReactDOM.createRoot(rootElement).render(app);
}