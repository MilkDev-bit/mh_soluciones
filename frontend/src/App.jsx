import { Suspense, useEffect } from 'react';
import AppRoutes from './routes';
import Loading from './components/common/Loading';
import InstallPWA from './components/common/InstallPWA';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import toast from 'react-hot-toast';
import useInactivityLogout from './hooks/useInactivityLogout';

// Helper function to detect network-related errors
const isNetworkError = (error) => {
  return (
    error?.message?.includes('WebSocket') ||
    error?.message?.includes('Network') ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('Failed to fetch') ||
    error?.response?.status === 401 ||
    error?.response?.status === 403 ||
    error?.name === 'TypeError'
  );
};

function App() {
  // Hook para auto-logout por inactividad
  useInactivityLogout();
  
  // Global error handlers
  useEffect(() => {
    // Handler para errores no capturados (síncronos)
    const handleError = (event) => {
      event.preventDefault(); // Prevenir pantalla de error del navegador
      
      const error = event.error || event.reason;
      
      if (isNetworkError(error)) {
        // Error de red - silencioso en producción
        if (import.meta.env.DEV) {
          console.warn('[Global] Network error caught:', error);
        }
        return;
      }
      
      // Error crítico - log y mostrar toast en lugar de pantalla completa
      console.error('[Global] Unhandled error:', error);
      if (import.meta.env.PROD) {
        // En producción, mostrar toast en lugar de pantalla de error
        toast.error('Ocurrió un problema. Por favor, recarga la página si persiste.');
      }
    };

    // Handler para promesas rechazadas no manejadas
    const handleUnhandledRejection = (event) => {
      event.preventDefault(); // Prevenir pantalla de error
      
      const error = event.reason;
      
      if (isNetworkError(error)) {
        if (import.meta.env.DEV) {
          console.warn('[Global] Network rejection caught:', error);
        }
        return;
      }
      
      console.error('[Global] Unhandled promise rejection:', error);
      if (import.meta.env.PROD) {
        toast.error('Ocurrió un problema. Por favor, recarga la página si persiste.');
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading fullscreen />}>
        <AppRoutes />
        
        <ToastContainer
          position="bottom-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
        
        <InstallPWA />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;