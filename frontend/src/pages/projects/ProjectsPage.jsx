import { useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectContext } from '../../contexts/ProjectContext';
import { getProjects } from '../../services/projectService';
import { isAdmin, isStudent } from '../../constants/roles';
import ProjectCard from '../../components/projects/ProjectCard';
import Loading from '../../components/common/Loading';
import { SkeletonList } from '../../components/common/Skeleton';
import Modal from '../../components/common/Modal';
import ProjectForm from '../../components/projects/ProjectForm';
import GradesWidget from '../../components/common/GradesWidget';
import { FiPlus, FiRefreshCw, FiBriefcase, FiChevronLeft, FiChevronRight, FiSearch, FiX } from 'react-icons/fi';
import './ProjectsPage.scss';

const STATUS_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'PLANNING', label: 'Planificación' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'ON_HOLD', label: 'En Espera' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

const ProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { projectsUpdated, consumeProjectsUpdate } = useProjectContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchInput, setSearchInput] = useState('');

  const page = parseInt(searchParams.get('page') || sessionStorage.getItem('projects_page') || '1', 10);
  const searchTerm = searchParams.get('search') || sessionStorage.getItem('projects_search') || '';
  const statusFilter = searchParams.get('status') || sessionStorage.getItem('projects_status') || '';

  // Initialize URL from sessionStorage if navigating back from a detail page without params
  useEffect(() => {
    if (!searchParams.has('page') && !searchParams.has('search') && !searchParams.has('status')) {
      const savedPage = sessionStorage.getItem('projects_page');
      const savedSearch = sessionStorage.getItem('projects_search');
      const savedStatus = sessionStorage.getItem('projects_status');
      
      if (savedPage || savedSearch || savedStatus) {
        const next = new URLSearchParams();
        if (savedPage && savedPage !== '1') next.set('page', savedPage);
        if (savedSearch) next.set('search', savedSearch);
        if (savedStatus) next.set('status', savedStatus);
        setSearchParams(next, { replace: true });
      }
    }
  }, [searchParams, setSearchParams]);

  // Sync state to sessionStorage whenever it changes
  useEffect(() => {
    setSearchInput(searchTerm);
    sessionStorage.setItem('projects_page', page.toString());
    sessionStorage.setItem('projects_search', searchTerm);
    sessionStorage.setItem('projects_status', statusFilter);
  }, [page, searchTerm, statusFilter]);

  const setPage = useCallback((newPage) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newPage === 1) next.delete('page');
      else next.set('page', String(newPage));
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setStatusFilter = useCallback((value) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (!value) next.delete('status');
      else next.set('status', value);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const { 
    data: projectsResponse,
    isLoading, 
    isFetching,
    refetch,
    isError 
  } = useQuery({
    queryKey: ['projects', user?.id, user?.role, page, searchTerm, statusFilter],
    queryFn: () => getProjects(page, searchTerm, statusFilter),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  const projects = projectsResponse?.results || [];

  useEffect(() => {
    if (isError) {
      toast.error('No se pudieron cargar los proyectos.');
    }
  }, [isError]);

  useEffect(() => {
    if (projectsUpdated) {
      refetch();
      consumeProjectsUpdate();
    }
  }, [projectsUpdated, refetch, consumeProjectsUpdate]);

  const handleProjectSaved = useCallback(() => {
    queryClient.invalidateQueries(['projects']);
    setIsModalOpen(false);
    setEditingProject(null);
    toast.success(editingProject ? '¡Proyecto actualizado!' : '¡Proyecto creado exitosamente!');
  }, [editingProject, queryClient]);

  const handleOpenModal = useCallback(() => {
    setEditingProject(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProject(null);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (searchInput) next.set('search', searchInput);
      else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
  };

  if (isLoading || !user) {
    return (
      <div className="page-container">
        <Helmet>
          <title>Proyectos | MH Soluciones</title>
        </Helmet>
        <div className="page-header">
          <div className="header-content">
            <div className="header-title">
              <FiBriefcase className="header-icon" />
              <h1>Salas de Trabajo (Proyectos)</h1>
            </div>
            <div className="header-subtitle">
              Gestiona y colabora en proyectos de manera eficiente
            </div>
          </div>
        </div>
        <SkeletonList count={6} />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Proyectos | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <Modal 
          title={editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'} 
          onClose={handleCloseModal}
        >
          <ProjectForm 
            project={editingProject} 
            onProjectSaved={handleProjectSaved} 
            onCancel={handleCloseModal}
          />
        </Modal>
      )}

      <div className="page-container">
        <div className="page-header">
          <div className="header-content">
            <div className="header-title">
              <FiBriefcase className="header-icon" />
              <h1>Salas de Trabajo (Proyectos)</h1>
            </div>
            <div className="header-subtitle">
              Gestiona y colabora en proyectos de manera eficiente
            </div>
          </div>
          <div className="header-actions">
            <form className="search-box" onSubmit={handleSearch}>
              <FiSearch className="search-icon" />
              <input 
                type="text" 
                placeholder="Buscar por región o nombre..." 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button type="button" className="clear-search" onClick={handleClearSearch}>
                  <FiX />
                </button>
              )}
            </form>
            {isFetching && (
              <Loading inline size="small" text="Actualizando..." />
            )}
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar proyectos"
            >
              <FiRefreshCw className={isFetching ? 'spinning' : ''} />
            </button>
            {user && user.role === 'SUPERADMIN' && (
              <button 
                className="btn btn-primary" 
                onClick={handleOpenModal}
                aria-label="Crear nuevo proyecto"
              >
                <FiPlus /> Nuevo Proyecto
              </button>
            )}
          </div>
        </div>
        
        {user && isStudent(user.role) && (
          <div className="projects-grades-widget-container">
            <GradesWidget isCollapsed={false} />
          </div>
        )}

        {user && isAdmin(user.role) && (
          <div className="status-filter-bar">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                className={`status-filter-btn${statusFilter === value ? ' active' : ''}${value ? ` status-${value.toLowerCase()}` : ''}`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        
        {projects.length > 0 ? (
          <>
            <div className="projects-grid" role="list" aria-label="Lista de proyectos">
              {projects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  className={project._isOptimistic ? 'optimistic-item' : ''}
                />
              ))}
            </div>

            <div className="pagination-wrapper">
              <div className="pagination-controls">
                <button 
                  className="btn btn-ghost" 
                  onClick={() => {
                    setPage(Math.max(1, page - 1));
                  }}
                  disabled={page === 1}
                >
                  <FiChevronLeft /> Anterior
                </button>
                
                <span className="page-number">Página <strong>{page}</strong></span>

                <button 
                  className="btn btn-ghost" 
                  onClick={() => {
                    setPage(page + 1);
                  }}
                  disabled={!projectsResponse?.next}
                >
                  Siguiente <FiChevronRight />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state glass-card" role="status">
            <FiBriefcase className="empty-state-icon" />
            <h2>No hay proyectos</h2>
            <p>
              {user && isAdmin(user.role) 
                ? 'Comienza creando tu primer proyecto haciendo clic en "Nuevo Proyecto"' 
                : 'Aún no eres miembro de ningún proyecto. Contacta a tu administrador.'}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;