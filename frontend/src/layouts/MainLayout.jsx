import { Outlet } from 'react-router-dom';
import { useContext } from 'react';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import { LayoutContext } from '../contexts/LayoutContext';
import './MainLayout.scss';

const MainLayout = () => {
  const { isSidebarCollapsed } = useContext(LayoutContext);
  
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
