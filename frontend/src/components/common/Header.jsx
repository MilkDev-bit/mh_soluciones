import React, { useState, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { FiUser, FiLogOut, FiMenu, FiX, FiChevronDown } from 'react-icons/fi';
import NotificationsDropdown from '../notifications/NotificationsDropdown';
import './Header.scss';

const pageTitles = {
  '/': 'Panel de Control',
  '/projects': 'Salas de Trabajo',
  '/tasks': 'Mis Tareas',
  '/calendar': 'Calendario',
  '/users': 'Usuarios',
  '/profile': 'Mi Perfil'
};

const Header = ({ onToggleSidebar, sidebarOpen }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      setScrolled(isScrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/projects/') && path.length > '/projects/'.length) {
      return 'Detalle del Proyecto';
    }
    return pageTitles[path] || '';
  };

  const handleLogout = () => {
    setIsDropdownOpen(false);
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <>
      <header className={`main-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="header-left">
          <button className="sidebar-toggle" onClick={onToggleSidebar}>
            {sidebarOpen ? <FiX /> : <FiMenu />}
          </button>
          <h1 className="header-title">{getPageTitle()}</h1>
        </div>

        <div className="header-right">
          <div className="header-actions">
            <NotificationsDropdown />
          </div>

          <div className="header-profile">
            <button
              className="profile-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="avatar-container">
                <img
                  src={
                    user.profile_picture ||
                    `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff`
                  }
                  alt="Avatar"
                  className="profile-avatar"
                />
              </div>
              <div className="profile-info">
                <span className="profile-name">
                  {user.first_name} {user.last_name}
                </span>
                <span className="profile-role">
                  {user.role.replace('_', ' ')}
                </span>
              </div>
              <FiChevronDown
                className={`dropdown-icon ${isDropdownOpen ? 'open' : ''}`}
              />
            </button>

            <div className={`profile-dropdown ${isDropdownOpen ? 'active' : ''}`}>
              <div className="dropdown-header">
                <div className="dropdown-avatar">
                  <img
                    src={
                      user.profile_picture ||
                      `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=f97316&color=fff`
                    }
                    alt="Avatar"
                  />
                </div>
                <div className="dropdown-user-info">
                  <span className="dropdown-name">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="dropdown-email">{user.email}</span>
                </div>
              </div>

              <div className="dropdown-divider"></div>

              <Link
                to="/profile"
                onClick={() => setIsDropdownOpen(false)}
                className="dropdown-item"
              >
                <FiUser /> Mi Perfil
              </Link>

              <div className="dropdown-divider"></div>

              <button onClick={handleLogout} className="dropdown-item">
                <FiLogOut /> Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        {isDropdownOpen && (
          <div
            className="dropdown-overlay"
            onClick={() => setIsDropdownOpen(false)}
          />
        )}
      </header>

      <div className="header-spacer"></div>
    </>
  );
};

export default Header;