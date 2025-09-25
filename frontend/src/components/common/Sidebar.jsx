import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { getProjects } from '../../services/projectService';
import { 
  FiGrid, 
  FiBriefcase, 
  FiCheckSquare, 
  FiCalendar, 
  FiUsers, 
  FiLogOut, 
  FiMenu,
  FiX,
  FiHome,
  FiSettings,
  FiPlus,
  FiFolder,
  FiAward,
  FiFileText
} from 'react-icons/fi';
import './Sidebar.scss';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    if (isMobileOpen || !isCollapsed) {
      fetchProjects();
    }
  }, [isMobileOpen, isCollapsed]);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsMobileOpen(false);
    }
  }, [location]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await getProjects();
      const projectsData = Array.isArray(response) ? response : (response.results || []);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsMobileOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMobileOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
    if (!isMobileOpen) {
      fetchProjects();
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const hasHrAccess = user.role === 'RH' || user.role === 'SUPERADMIN';

  return (
    <>
      <button 
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Abrir menú"
      >
        <FiMenu />
      </button>

      {isMobileOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'sidebar-open' : ''} ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="logo-container">
              <NavLink to="/" className="logo" onClick={closeMobileMenu}>
                <span className="logo-icon">MH</span>
                {!isCollapsed && (
                  <div className="logo-text">
                    <span className="logo-main">Soluciones</span>
                    <span className="logo-sub">Empresariales</span>
                  </div>
                )}
              </NavLink>
            </div>
            <div className="header-actions">
              <button 
                className="collapse-toggle"
                onClick={toggleCollapse}
                aria-label={isCollapsed ? "Expandir menú" : "Contraer menú"}
              >
                <FiMenu />
              </button>
              <button 
                className="sidebar-close"
                onClick={closeMobileMenu}
                aria-label="Cerrar menú"
              >
                <FiX />
              </button>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="menu-section">
              <span className="menu-section-title">Principal</span>
              <div className="menu-items">
                <NavLink 
                  to="/" 
                  className="menu-item"
                  onClick={closeMobileMenu}
                >
                  <FiHome />
                  {!isCollapsed && <span>Panel de Control</span>}
                </NavLink>
                
                <NavLink 
                  to="/projects" 
                  className="menu-item"
                  onClick={closeMobileMenu}
                >
                  <FiBriefcase />
                  {!isCollapsed && <span>Proyectos</span>}
                </NavLink>
                
                <NavLink 
                  to="/tasks" 
                  className="menu-item"
                  onClick={closeMobileMenu}
                >
                  <FiCheckSquare />
                  {!isCollapsed && <span>Tareas</span>}
                </NavLink>
                
                <NavLink 
                  to="/calendar" 
                  className="menu-item"
                  onClick={closeMobileMenu}
                >
                  <FiCalendar />
                  {!isCollapsed && <span>Calendario</span>}
                </NavLink>
              </div>
            </div>

            <div className="menu-section">
              <span className="menu-section-title">Salas de Trabajo</span>
              <div className="menu-items">
                {loading ? (
                  <div className="projects-loading">
                    <div className="loading-spinner-small"></div>
                    {!isCollapsed && <span>Cargando proyectos...</span>}
                  </div>
                ) : projects.length > 0 ? (
                  <>
                    {projects.slice(0, 5).map(project => (
                      <NavLink 
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className="menu-item project-item"
                        onClick={closeMobileMenu}
                      >
                        <FiFolder />
                        {!isCollapsed && (
                          <div className="project-info">
                            <span className="project-name">{project.name}</span>
                            <span className="project-description">
                              {project.description || 'Este proyecto no tiene una descripción...'}
                            </span>
                          </div>
                        )}
                      </NavLink>
                    ))}
                    
                    {projects.length > 5 && !isCollapsed && (
                      <div className="projects-more">
                        <span>+{projects.length - 5} más</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="projects-empty">
                    <FiFolder />
                    {!isCollapsed && <span>No hay proyectos</span>}
                  </div>
                )}
              </div>
            </div>

            {(user.role === 'SUPERADMIN' || user.role === 'ADMIN') && (
              <div className="menu-section">
                <span className="menu-section-title">Gestión</span>
                <div className="menu-items">
                  <NavLink 
                    to="/admin/users" 
                    className="menu-item"
                    onClick={closeMobileMenu}
                  >
                    <FiUsers />
                    {!isCollapsed && <span>Usuarios</span>}
                  </NavLink>
                </div>
              </div>
            )}

            {user.role === 'RH' && hasHrAccess && (
                <div className="menu-section">
                  <span className="menu-section-title">Recursos Humanos</span>
                  <div className="menu-items">
                    <NavLink 
                      to="/hr" 
                      className="menu-item"
                      onClick={closeMobileMenu}
                    >
                      <FiFileText />
                      {!isCollapsed && <span>Portal RH</span>}
                    </NavLink>
                  </div>
                </div>
            )}

          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <img 
                src={user.profile_picture || `https://ui-avatars.com/api/?name=${user.first_name}+${user.last_name}&background=ff7c15&color=fff`} 
                alt="Avatar" 
                className="user-avatar" 
              />
              {!isCollapsed && (
                <div className="user-info">
                  <span className="user-name">{user.first_name} {user.last_name}</span>
                  <span className="user-role">{user.role}</span>
                </div>
              )}
              <button 
                className="logout-button"
                onClick={handleLogout}
                title="Cerrar sesión"
              >
                <FiLogOut />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;