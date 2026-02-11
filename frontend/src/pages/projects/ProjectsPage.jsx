import { useState, useCallback, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectContext } from '../../contexts/ProjectContext';
import { getProjects } from '../../services/projectService';
import { isAdmin, isStudent } from '../../constants/roles';
import ProjectCard from '../../components/projects/ProjectCard';
import Loading from '../../components/common/Loading';
import Skeleton, { SkeletonList } from '../../components/common/Skeleton';
import Modal from '../../components/common/Modal';
import ProjectForm from '../../components/projects/ProjectForm';
import GradesWidget from '../../components/common/GradesWidget';
import { FiPlus, FiRefreshCw, FiBriefcase } from 'react-icons/fi';
import './ProjectsPage.scss';

const ProjectsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { projectsUpdated, consumeProjectsUpdate } = useProjectContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  // Use React Query for data fetching with caching
  const { 
    data: projectsData, 
    isLoading, 
    isFetching,
    refetch 
  } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    select: (data) => data.results || data,
    onError: (error) => {
      console.error('Error fetching projects:', error);
      toast.error('No se pudieron cargar los proyectos.');
    }
  });

  const projects = projectsData || [];

  // Listen for project updates from other components
  useEffect(() => {
    if (projectsUpdated) {
      refetch();
      consumeProjectsUpdate();
    }
  }, [projectsUpdated, refetch, consumeProjectsUpdate]);

  const handleProjectSaved = useCallback((savedProject) => {
    if (editingProject) {
      toast.success('¡Proyecto actualizado!');
    } else {
      toast.success('¡Proyecto creado exitosamente!');
    }

    // Invalidate and refetch projects
    queryClient.invalidateQueries(['projects']);
    setIsModalOpen(false);
    setEditingProject(null);
  }, [editingProject, queryClient]);

  const handleOpenModal = useCallback(() => {
    setEditingProject(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProject(null);
  }, []);
  
  if (isLoading || !user) {
    return (
      <>
        <Helmet>
          <title>Proyectos | MH Soluciones</title>
        </Helmet>
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
          </div>
          <SkeletonList count={6} />
        </div>
      </>
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
            {user && isAdmin(user.role) && (
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
        
        {/* Grades Widget for Students */}
        {user && isStudent(user.role) && (
          <div className="projects-grades-widget-container">
            <GradesWidget isCollapsed={false} />
          </div>
        )}
        
        {projects.length > 0 ? (
          <div className="projects-grid" role="list" aria-label="Lista de proyectos">
            {projects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                className={project._isOptimistic ? 'optimistic-item' : ''}
              />
            ))}
          </div>
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