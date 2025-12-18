import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FiCheckCircle, FiCloud, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const GoogleDriveConnect = () => {
  const { user } = useAuth();
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

    // Handle OAuth callback status
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('google_auth');
    
    if (authStatus) {
      // Remove the query parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show appropriate message based on status
      switch (authStatus) {
        case 'success':
          toast.success('¡Google Drive institucional conectado exitosamente!');
          setIsConnected(true);
          break;
        case 'denied':
          toast.error('Acceso denegado. Debes autorizar el acceso a Google Drive para continuar.');
          break;
        case 'error_permissions':
          toast.error('No tienes permisos para conectar Google Drive institucional. Solo el SUPERADMIN puede realizar esta acción.');
          break;
        case 'error_state':
          toast.error('Error de seguridad. Por favor, intenta conectar nuevamente.');
          break;
        case 'error_expired':
          toast.error('La sesión de autenticación expiró. Por favor, intenta conectar nuevamente.');
          break;
        case 'error_user':
          toast.error('Error de usuario. Por favor, inicia sesión nuevamente.');
          break;
        case 'error_token':
          toast.error('Error al obtener credenciales de Google. Por favor, intenta nuevamente.');
          break;
        case 'error_db':
          toast.error('Error al guardar las credenciales. Por favor, contacta al administrador.');
          break;
        case 'error':
        default:
          toast.error('Ocurrió un error al conectar con Google. Por favor, intenta nuevamente.');
          break;
      }
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
        if (error.response?.status === 403) {
          toast.error("No tienes permisos para conectar Google Drive institucional.");
        } else {
          toast.error("No se pudo iniciar la conexión con Google.");
        }
        console.error("Error al obtener la URL de autorización:", error);
        setIsRedirecting(false);
    }
  };

  // Only SUPERADMIN can see this component
  if (!user || user.role !== 'SUPERADMIN') {
    return null;
  }

  if (isLoading) {
    return <p>Verificando conexión con Google Drive...</p>;
  }

  return (
    <div className="google-connect-widget">
        <div className="security-info">
            <FiCloud className="security-icon" />
            <div>
                <h4>Google Drive Institucional</h4>
                <p className="help-text">
                    Como SUPERADMIN, tu cuenta de Google Drive se usará como repositorio institucional centralizado 
                    para todos los archivos del sistema.
                </p>
            </div>
        </div>

        {isConnected ? (
            <div className="status-badge active">
                <FiCheckCircle /> Drive Conectado
            </div>
        ) : (
            <div className="connect-section">
                <div className="alert-warning">
                    <FiAlertCircle />
                    <p>
                        <strong>Acción requerida:</strong> Debes conectar tu Google Drive para que el sistema 
                        pueda almacenar archivos de forma centralizada. Esta es la cuenta institucional principal.
                    </p>
                </div>
                <button 
                  className="btn btn-primary" 
                  onClick={handleConnectClick}
                  disabled={isRedirecting}
                >
                  {isRedirecting ? 'Conectando...' : 'Conectar Drive Institucional'}
                </button>
            </div>
        )}
    </div>
  );
};

export default GoogleDriveConnect;