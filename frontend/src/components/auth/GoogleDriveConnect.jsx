import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiCheckCircle, FiCloud } from 'react-icons/fi';
import toast from 'react-hot-toast';

const GoogleDriveConnect = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await api.get('/auth/google/status/');
        setIsConnected(response.data.is_connected);
      } catch (error) {
        console.error('Error al verificar el estado de Google Drive:', error);
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('google_auth') === 'success') {
      toast.success('¡Tu cuenta de Google se ha conectado exitosamente!');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnectClick = async () => {
    setIsRedirecting(true);
    try {
        const response = await api.get('/auth/google/auth/');
        const { authorization_url } = response.data;
        
        if (authorization_url) {
            window.location.href = authorization_url;
        }
    } catch (error) {
        toast.error("No se pudo iniciar la conexión con Google.");
        console.error("Error al obtener la URL de autorización:", error);
        setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return <p>Verificando conexión con Google Drive...</p>;
  }

  return (
    <div className="google-connect-widget">
        <div className="security-info">
            <FiCloud className="security-icon" />
            <div>
                <h4>Conexión con Google Drive</h4>
                <p>
                    Conecta tu cuenta para guardar automáticamente los archivos de las tareas en tu
                    propio Google Drive, manteniendo todo organizado y seguro.
                </p>
            </div>
        </div>

        {isConnected ? (
            <div className="status-badge active">
                <FiCheckCircle /> Conectado
            </div>
        ) : (
            <button 
              className="btn btn-primary" 
              onClick={handleConnectClick}
              disabled={isRedirecting}
            >
              {isRedirecting ? 'Redirigiendo...' : 'Conectar con Google'}
            </button>
        )}
    </div>
  );
};

export default GoogleDriveConnect;