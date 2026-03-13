import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProjectProvider } from './contexts/ProjectContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { LayoutProvider } from './contexts/LayoutContext.jsx';
import './assets/styles/main.scss';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000, 
      retry: 1,
      refetchOnWindowFocus: false, 
      refetchOnReconnect: false, 
      refetchOnMount: false, 
    },
    mutations: {
      retry: 1,
    },
  },
});

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

if (import.meta.env.DEV) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>{app}</React.StrictMode>
  );
} else {
  ReactDOM.createRoot(rootElement).render(app);
}