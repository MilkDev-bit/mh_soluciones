import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../../services/api';
import { FiLoader } from 'react-icons/fi';
import './AuthPages.scss';

const REDIRECT_DELAY = 2000;

const GoogleCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple executions
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      // Extract parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Check if user denied access
      if (error) {
        console.log('User denied Google OAuth access:', error);
        setStatus('error');
        setErrorMessage('Acceso denegado');
        setTimeout(() => {
          navigate('/profile?google_auth=denied');
        }, REDIRECT_DELAY);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        console.error('Missing code or state parameter');
        setStatus('error');
        setErrorMessage('Parámetros de autenticación inválidos');
        setTimeout(() => {
          navigate('/profile?google_auth=error_params');
        }, REDIRECT_DELAY);
        return;
      }

      try {
        // Send POST request to backend with OAuth parameters
        const response = await api.post('/auth/google/callback/', {
          code,
          state,
        });

        if (response.data.success) {
          setStatus('success');
          // Redirect to profile with success message
          setTimeout(() => {
            navigate('/profile?google_auth=success');
          }, REDIRECT_DELAY);
        } else {
          setStatus('error');
          setErrorMessage(response.data.error || 'Error desconocido');
          setTimeout(() => {
            navigate('/profile?google_auth=error');
          }, REDIRECT_DELAY);
        }
      } catch (error) {
        console.error('Error processing Google OAuth callback:', error);
        setStatus('error');
        
        // Handle specific error responses
        if (error.response?.data?.error) {
          setErrorMessage(error.response.data.error);
        } else if (error.response?.status === 403) {
          // ✅ Permission error
          setErrorMessage('No tienes permisos para conectar Google Drive institucional');
        } else if (error.response?.status === 400) {
          setErrorMessage('Error de validación');
        } else if (error.response?.status === 401) {
          setErrorMessage('Sesión expirada');
        } else {
          setErrorMessage('Error al conectar con el servidor');
        }

        // Redirect to profile with error status
        const errorType = error.response?.data?.error_type || 'error';
        setTimeout(() => {
          navigate(`/profile?google_auth=${errorType}`);
        }, REDIRECT_DELAY);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <>
      <Helmet>
        <title>Conectando con Google | MH Soluciones</title>
      </Helmet>
      
      <div className="auth-container">
        <div className="auth-card">
          <div className="callback-status">
            {status === 'processing' && (
              <>
                <FiLoader className="spinner" size={48} />
                <h2>Conectando con Google Drive</h2>
                <p>Por favor espera mientras procesamos tu autenticación...</p>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="success-icon">✓</div>
                <h2>¡Conexión exitosa!</h2>
                <p>Tu cuenta de Google Drive ha sido conectada correctamente.</p>
                <p className="redirect-message">Redirigiendo a tu perfil...</p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="error-icon">✕</div>
                <h2>Error en la conexión</h2>
                <p>{errorMessage}</p>
                <p className="redirect-message">Redirigiendo a tu perfil...</p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GoogleCallbackPage;
