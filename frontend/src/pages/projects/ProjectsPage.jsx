import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useProjectContext } from '../../contexts/ProjectContext';
import { getProjects } from '../../services/projectService';
import ProjectCard from '../../components/projects/ProjectCard';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import ProjectForm from '../../components/projects/ProjectForm';
import './ProjectsPage.scss';

const ProjectsPage = () => {
  const { user } = useAuth();
  const { triggerProjectsUpdate, projectsUpdated, consumeProjectsUpdate } = useProjectContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const fetchProjects = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const response = await getProjects();
      setProjects(response.results || response);
    } catch (error) {
      toast.error('No se pudieron cargar los proyectos.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Listen for project updates from other components
  useEffect(() => {
    if (projectsUpdated) {
      fetchProjects(true);
      consumeProjectsUpdate();
    }
  }, [projectsUpdated, fetchProjects, consumeProjectsUpdate]);

  // Listen for external project update events
  useEffect(() => {
    const handleProjectChange = () => {
      fetchProjects(true);
    };
    window.addEventListener('projectsUpdated', handleProjectChange);
    return () => window.removeEventListener('projectsUpdated', handleProjectChange);
  }, [fetchProjects]);

  const handleProjectSaved = useCallback((savedProject) => {
    if (editingProject) {
      // Optimistic update for edit
      setProjects(prev => prev.map(p => p.id === savedProject.id ? savedProject : p));
      toast.success('¡Proyecto actualizado!');
    } else {
      // Optimistic update for create
      setProjects(prev => [savedProject, ...prev]);
      toast.success('¡Proyecto creado exitosamente!');
    }

    triggerProjectsUpdate();
    setIsModalOpen(false);
    setEditingProject(null);
  }, [editingProject, triggerProjectsUpdate]);

  const handleOpenModal = useCallback(() => {
    setEditingProject(null);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingProject(null);
  }, []);
  
  if (loading || !user) {
    return <Loading fullscreen text="Cargando proyectos..." />;
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
          <h1>Salas de Trabajo (Proyectos)</h1>
          <div className="header-actions">
            {isRefreshing && (
              <Loading inline size="small" text="Actualizando..." />
            )}
            {user && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(user.role) && (
              <button 
                className="btn btn-primary" 
                onClick={handleOpenModal}
                aria-label="Crear nuevo proyecto"
              >
                + Nuevo Proyecto
              </button>
            )}
          </div>
        </div>
        
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
          <div className="empty-state" role="status">
            <h2>No hay proyectos</h2>
            <p>Aún no se han creado proyectos o no eres miembro de ninguno.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;