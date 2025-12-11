import React, { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import './InstallPWA.scss';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      return;
    }

    // Check if user has dismissed the prompt before
    const dismissedDate = localStorage.getItem('pwa-install-dismissed');
    if (dismissedDate) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedDate)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't show again for 7 days
      }
    }

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show install prompt after a short delay
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissClick = () => {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    setShowInstallPrompt(false);
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="install-pwa-banner">
      <div className="install-pwa-content">
        <div className="install-pwa-icon">
          <FiDownload />
        </div>
        <div className="install-pwa-text">
          <h4>Instalar MH Soluciones</h4>
          <p>Accede más rápido y trabaja sin conexión</p>
        </div>
        <div className="install-pwa-actions">
          <button 
            className="install-btn" 
            onClick={handleInstallClick}
            aria-label="Instalar aplicación"
          >
            Instalar
          </button>
          <button 
            className="dismiss-btn" 
            onClick={handleDismissClick}
            aria-label="Cerrar"
          >
            <FiX />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;
