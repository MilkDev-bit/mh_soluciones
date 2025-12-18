import { Suspense } from 'react';
import AppRoutes from './routes';
import Loading from './components/common/Loading';
import InstallPWA from './components/common/InstallPWA';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import useInactivityLogout from './hooks/useInactivityLogout';

function App() {
  // Hook para auto-logout por inactividad
  useInactivityLogout();
  
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