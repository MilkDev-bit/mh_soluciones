import { useEffect, useState } from 'react';
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
  const { triggerProjectsUpdate } = useProjectContext();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await getProjects();
        setProjects(response.results || response);
      } catch (error) {
        toast.error('No se pudieron cargar los proyectos.');
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleProjectSaved = (savedProject) => {
    if (editingProject) {
      setProjects(projects.map(p => p.id === savedProject.id ? savedProject : p));
      toast.success('¡Proyecto actualizado!');
    } else {
      setProjects([savedProject, ...projects]);
      toast.success('¡Proyecto creado exitosamente!');
    }

    triggerProjectsUpdate();
    setIsModalOpen(false);
    setEditingProject(null);
  };
  
  if (loading || !user) {
    return <Loading fullscreen />;
  }

  return (
    <>
      <Helmet>
        <title>Proyectos | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <Modal 
          title={editingProject ? 'Editar Proyecto' : 'Nuevo Proyecto'} 
          onClose={() => setIsModalOpen(false)}
        >
          <ProjectForm 
            project={editingProject} 
            onProjectSaved={handleProjectSaved} 
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>
      )}

      <div className="page-container">
        <div className="page-header">
          <h1>Salas de Trabajo (Proyectos)</h1>
          {user && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(user.role) && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            + Nuevo Proyecto
          </button>
          )}
        </div>
        
        {projects.length > 0 ? (
          <div className="projects-grid">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>No hay proyectos</h2>
            <p>Aún no se han creado proyectos o no eres miembro de ninguno.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default ProjectsPage;