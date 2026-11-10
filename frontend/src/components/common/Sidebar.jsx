import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { ProjectContext } from '../../contexts/ProjectContext';
import { LayoutContext } from '../../contexts/LayoutContext';
import { getProjects } from '../../services/projectService';
import GradesWidget from './GradesWidget';
import {
  canManageUsers,
  canViewReports,
  isStudent
} from '../../constants/roles';
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
  FiFileText,
  FiRefreshCw,
  FiActivity,
  FiMessageSquare,
  FiFile,
  FiBarChart2,
  FiBell,
  FiShield,
  FiClipboard
} from 'react-icons/fi';
import './Sidebar.scss';
import matrixMhLogo from '/icons/MatrixMh.png';

const Sidebar = () => {
  const { user, logout } = useContext(AuthContext);
  const { projectsUpdated, setProjectsUpdated } = useContext(ProjectContext);
  const { isSidebarCollapsed, setIsSidebarCollapsed, isSidebarOpen, setIsSidebarOpen } = useContext(LayoutContext);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (projectsUpdated) {
      // Background update - don't show loading spinner to avoid re-renders that close modals
      fetchProjects(true);
    } else if (isSidebarOpen || !isSidebarCollapsed) {
      // Initial load or sidebar opening - show loading
      fetchProjects(false);
    }
  }, [isSidebarOpen, isSidebarCollapsed, projectsUpdated]);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  }, [location]);

  const fetchProjects = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await getProjects();
      const projectsData = Array.isArray(response) ? response : (response.results || []);
      setProjects(projectsData);

      if (projectsUpdated && setProjectsUpdated) {
        setProjectsUpdated(false);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshProjects = () => {
    setRefreshing(true);
    fetchProjects(false); // Explicit refresh by user - show spinner
  };

  useEffect(() => {
    const handleProjectsUpdate = () => {
      fetchProjects(true); // Always silent for window events
    };

    window.addEventListener('projectsUpdated', handleProjectsUpdate);

    return () => {
      window.removeEventListener('projectsUpdated', handleProjectsUpdate);
    };
  }, []);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    setIsSidebarOpen(false);
  };

  const closeMobileMenu = () => {
    setIsSidebarOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsSidebarOpen(!isSidebarOpen);
    if (!isSidebarOpen) {
      fetchProjects();
    }
  };

  const toggleCollapse = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const hasHrAccess = user.role === 'RH' || user.role === 'SUPERADMIN';
  // Solo RH puede gestionar usuarios
  const hasUserManagementAccess = canManageUsers(user.role);
  const hasReportsAccess = canViewReports(user.role);
  const isStudentUser = isStudent(user.role);
  const canViewArchivos = user.role !== 'CEO' &&
    user.role !== 'STUDENT' &&
    user.role !== 'CLIENT' &&
    user.role !== 'RH';

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Abrir menú"
      >
        <FiMenu />
      </button>

      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="sidebar-content">
          <div className="sidebar-header">
            <div className="logo-container">
              <NavLink to="/" className="logo" onClick={closeMobileMenu}>
                <img src={matrixMhLogo} alt="MH" className="logo-icon" />
                {!isSidebarCollapsed && (
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
                aria-label={isSidebarCollapsed ? "Expandir menú" : "Contraer menú"}
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
                  title={isSidebarCollapsed ? 'Panel de Control' : undefined}
                  onClick={closeMobileMenu}
                >
                  <FiHome />
                  {!isSidebarCollapsed && <span>Panel de Control</span>}
                </NavLink>

                <NavLink
                  to="/actividad"
                  className="menu-item"
                  title={isSidebarCollapsed ? 'Actividad' : undefined}
                  onClick={closeMobileMenu}
                >
                  <FiActivity />
                  {!isSidebarCollapsed && <span>Actividad</span>}
                </NavLink>

                <NavLink
                  to="/notificaciones"
                  className="menu-item"
                  title={isSidebarCollapsed ? 'Notificaciones' : undefined}
                  onClick={closeMobileMenu}
                >
                  <FiBell />
                  {!isSidebarCollapsed && <span>Notificaciones</span>}
                </NavLink>

                <NavLink
                  to="/projects"
                  className="menu-item"
                  title={isSidebarCollapsed ? 'Equipos' : undefined}
                  onClick={closeMobileMenu}
                >
                  <FiBriefcase />
                  {!isSidebarCollapsed && <span>Equipos</span>}
                </NavLink>

                {/* Restringir Tareas para RH */}
                {user.role !== 'RH' && (
                  <NavLink
                    to="/tasks"
                    className="menu-item"
                    title={isSidebarCollapsed ? 'Tareas' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <FiCheckSquare />
                    {!isSidebarCollapsed && <span>Tareas</span>}
                  </NavLink>
                )}

                <NavLink
                  to="/calendar"
                  className="menu-item"
                  title={isSidebarCollapsed ? 'Calendario' : undefined}
                  onClick={closeMobileMenu}
                >
                  <FiCalendar />
                  {!isSidebarCollapsed && <span>Calendario</span>}
                </NavLink>

                {canViewArchivos && (
                  <NavLink
                    to="/archivos"
                    className="menu-item"
                    title={isSidebarCollapsed ? 'Archivos' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <FiFile />
                    {!isSidebarCollapsed && <span>Archivos</span>}
                  </NavLink>
                )}

                {hasReportsAccess && !isStudentUser && (
                  <NavLink
                    to="/reportes"
                    className="menu-item"
                    title={isSidebarCollapsed ? 'Reportes' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <FiBarChart2 />
                    {!isSidebarCollapsed && <span>Reportes</span>}
                  </NavLink>
                )}
              </div>
            </div>

            <div className="menu-section">
              <div className="section-header">
                <span className="menu-section-title">Salas de Trabajo</span>
                {!isSidebarCollapsed && (
                  <button
                    className="refresh-projects-btn"
                    onClick={handleRefreshProjects}
                    disabled={refreshing}
                    title="Actualizar proyectos"
                  >
                    <FiRefreshCw className={refreshing ? 'spinning' : ''} />
                  </button>
                )}
              </div>
              <div className="menu-items">
                {loading ? (
                  <div className="projects-loading">
                    <div className="loading-spinner-small"></div>
                    {!isSidebarCollapsed && <span>Cargando proyectos...</span>}
                  </div>
                ) : projects.length > 0 ? (
                  <>
                    {projects.slice(0, 5).map(project => (
                      <NavLink
                        key={project.id}
                        to={`/projects/${project.id}`}
                        className="menu-item project-item"
                        title={isSidebarCollapsed ? project.name : undefined}
                        onClick={closeMobileMenu}
                      >
                        <FiFolder />
                        {!isSidebarCollapsed && (
                          <div className="project-info">
                            <span className="project-name">{project.name}</span>
                            <span className="project-description">
                              {project.description || 'Este proyecto no tiene una descripción...'}
                            </span>
                          </div>
                        )}
                      </NavLink>
                    ))}

                    {projects.length > 5 && !isSidebarCollapsed && (
                      <div className="projects-more">
                        <span>+{projects.length - 5} más</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="projects-empty">
                    <FiFolder />
                    {!isSidebarCollapsed && <span>No hay proyectos</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Restringir Gestión de usuarios para RH */}
            {user.role !== 'RH' && hasUserManagementAccess && (
              <div className="menu-section">
                <span className="menu-section-title">Gestión</span>
                <div className="menu-items">
                  <NavLink
                    to="/admin/users"
                    className="menu-item"
                    title={isSidebarCollapsed ? 'Usuarios' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <FiUsers />
                    {!isSidebarCollapsed && <span>Usuarios</span>}
                  </NavLink>

                  {user.role === 'SUPERADMIN' && (
                    <NavLink
                      to="/admin/accesos"
                      className="menu-item"
                      title={isSidebarCollapsed ? 'Accesos' : undefined}
                      onClick={closeMobileMenu}
                    >
                      <FiShield />
                      {!isSidebarCollapsed && <span>Accesos</span>}
                    </NavLink>
                  )}

                  {user.role === 'SUPERADMIN' && (
                    <NavLink
                      to="/admin/audit-log"
                      className="menu-item"
                      title={isSidebarCollapsed ? 'Auditoría' : undefined}
                      onClick={closeMobileMenu}
                    >
                      <FiClipboard />
                      {!isSidebarCollapsed && <span>Auditoría</span>}
                    </NavLink>
                  )}
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
                    title={isSidebarCollapsed ? 'Portal RH' : undefined}
                    onClick={closeMobileMenu}
                  >
                    <FiFileText />
                    {!isSidebarCollapsed && <span>Portal RH</span>}
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
              {!isSidebarCollapsed && (
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