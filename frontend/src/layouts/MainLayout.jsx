import { Outlet } from 'react-router-dom';
import { useContext } from 'react';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import { LayoutContext } from '../contexts/LayoutContext';
import { useAuth } from '../contexts/AuthContext';
import PrivacyNoticeGate from '../components/privacy/PrivacyNoticeGate';
import './MainLayout.scss';

const MainLayout = () => {
  const { isSidebarCollapsed } = useContext(LayoutContext);
  const { user } = useAuth();

  // Primer inicio de sesión (o aviso actualizado): antes de usar la app hay
  // que aceptar el Aviso de Privacidad. No se carga nada más mientras tanto.
  if (user && user.privacy_accepted === false) {
    return <PrivacyNoticeGate />;
  }
  
  return (
    <div className={`main-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar />
      <main className="main-content">
        <Header />
        <div className="content-container">
          <Outlet /> 
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
