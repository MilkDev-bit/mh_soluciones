import { useState, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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

  // [FIX] Filtros de Equipos que se perdían:
  // - Si un filtro de estado no tenía resultados, un efecto lo BORRABA solo
  //   (p. ej. "Cancelado", o "En Espera" + una búsqueda).
  // - Se guardaban en sessionStorage (solo esa pestaña): en otra pestaña,
  //   al volver a entrar o tras iniciar sesión se perdían.
  // Ahora la URL es la única fuente de verdad y se recuerda en localStorage
  // (por usuario); al entrar a /projects sin parámetros se restauran.
  const storageKey = `projects_filters_${user?.id ?? 'anon'}`;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || '';
  const hasActiveFilters = Boolean(searchTerm || statusFilter);
  const restoredRef = useRef(false);
  const [filtersReady, setFiltersReady] = useState(false);

  // Restaurar filtros guardados al llegar sin parámetros (menú lateral, volver
  // de un proyecto, nueva pestaña). Solo una vez por visita a la página.
  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;
    setFiltersReady(true);
    if (searchParams.has('page') || searchParams.has('search') || searchParams.has('status')) return;
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    } catch {
      saved = null;
    }
    if (!saved) return;
    const next = new URLSearchParams();
    if (saved.page && saved.page > 1) next.set('page', String(saved.page));
    if (saved.search) next.set('search', saved.search);
    if (saved.status) next.set('status', saved.status);
    if ([...next.keys()].length) setSearchParams(next, { replace: true });
  }, [user, storageKey, searchParams, setSearchParams]);

  // Guardar cada cambio y reflejar la búsqueda en el input.
  useEffect(() => {
    setSearchInput(searchTerm);
    if (!user || !restoredRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ page, search: searchTerm, status: statusFilter }));
    } catch {
      /* sin storage: los filtros siguen en la URL */
    }
  }, [user, storageKey, page, searchTerm, statusFilter]);

  const updateParams = useCallback((changes) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined || (key === 'page' && Number(value) <= 1)) next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setPage = useCallback((newPage) => updateParams({ page: newPage }), [updateParams]);

  const setStatusFilter = useCallback((value) => updateParams({ status: value || '', page: 1 }), [updateParams]);

  const clearFilters = useCallback(() => {
    setSearchInput('');
    updateParams({ status: '', search: '', page: 1 });
  }, [updateParams]);

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
    enabled: !!user && filtersReady,
    placeholderData: keepPreviousData,
  });

  const projects = projectsResponse?.results || [];

  useEffect(() => {
    if (isError) {
      toast.error('No se pudieron cargar los proyectos.');
    }
  }, [isError]);

  // Si la página actual quedó vacía (p. ej. se borraron proyectos), volver a
  // la página 1. Los filtros NO se tocan: si no hay coincidencias se muestra
  // un mensaje con la opción de quitarlos.
  useEffect(() => {
    if (!isLoading && !isFetching && !isError && projectsResponse) {
      if (projects.length === 0 && page > 1) {
        setPage(1);
      }
    }
  }, [isLoading, isFetching, isError, projectsResponse, projects.length, page, setPage]);

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
    updateParams({ search: searchInput.trim(), page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateParams({ search: '', page: 1 });
  };

  if (isLoading || !user || !filtersReady) {
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
            {hasActiveFilters ? (
              <>
                <h2>Sin coincidencias</h2>
                <p>No hay proyectos que coincidan con los filtros aplicados.</p>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Quitar filtros
                </button>
              </>
            ) : (
              <>
                <h2>No hay proyectos</h2>
                <p>
                  {user && isAdmin(user.role) 
                    ? 'Comienza creando tu primer proyecto haciendo clic en "Nuevo Proyecto"' 
                    : 'Aún no eres miembro de ningún proyecto. Contacta a tu administrador.'}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;