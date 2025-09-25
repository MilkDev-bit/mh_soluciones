import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Header from '../components/common/Header';
import './MainLayout.scss';

const MainLayout = () => {
  return (
    <div className="main-layout">
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