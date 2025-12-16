import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'react-hot-toast';

import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ProjectProvider } from './contexts/ProjectContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import './assets/styles/main.scss';

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/custom-sw.js', { scope: '/' })
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
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
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);