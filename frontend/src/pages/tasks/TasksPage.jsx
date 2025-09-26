import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getTasks } from '../../services/taskService';
import { getProjects, getProjectMembers } from '../../services/projectService';
import { getCurrentUserFromSession } from '../../services/userService';
import { getDocumentsByTask } from '../../services/documentService';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import TaskForm from '../../components/tasks/TaskForm';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import { FiCheckSquare, FiFilter, FiPaperclip } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import './TasksPage.scss';
import { getFileUrl } from '../../services/documentService';

const TasksPage = () => {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [taskDocuments, setTaskDocuments] = useState({});

  useEffect(() => {
      const fetchData = async () => {
      try {
        setLoading(true);
        const [userData, tasksData, projectsData] = await Promise.all([
          getCurrentUserFromSession(),
          getTasks(),
          getProjects(),
        ]);

        setUser(userData);
        const tasksList = Array.isArray(tasksData.results) ? tasksData.results : [];
        
        let filteredTasks = tasksList;
        if (userData.role === 'STUDENT') {
          filteredTasks = tasksList.filter(task => task.assigned_to?.id === userData.id);
        }
        
        setTasks(filteredTasks);
        
        let filteredProjects = Array.isArray(projectsData.results) ? projectsData.results : [];
        if (userData.role === 'STUDENT') {
          filteredProjects = filteredProjects.filter(project => 
            project.members?.some(member => 
              member.user?.id === userData.id || member.id === userData.id
            )
          );
        }
        
        setProjects(filteredProjects);
        
        const documentsPromises = filteredTasks.map(async (task) => {
          try {
            const documents = await getDocumentsByTask(task.id);
            return { taskId: task.id, documents };
          } catch (error) {
            console.error(`Error fetching documents for task ${task.id}:`, error);
            return { taskId: task.id, documents: [] };
          }
        });
        
        const documentsResults = await Promise.all(documentsPromises);
        const documentsMap = {};
        documentsResults.forEach(result => {
          documentsMap[result.taskId] = result.documents;
        });
        setTaskDocuments(documentsMap);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('No se pudieron cargar los datos.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      if (selectedProject !== 'all') {
        try {
          const members = await getProjectMembers(selectedProject);
          setProjectMembers(members);
        } catch (error) {
          console.error('Error fetching project members:', error);
          setProjectMembers([]);
        }
      } else {
        setProjectMembers([]);
      }
    };
    fetchMembers();
  }, [selectedProject, isModalOpen]);

  const filteredTasks =
    selectedProject === 'all'
      ? tasks
      : tasks.filter((task) => task.project === parseInt(selectedProject));

  if (loading || !user) {
    return <Loading fullscreen />;
  }

  return (
    <>
      <Helmet>
        <title>{user.role === 'STUDENT' ? 'Mis Tareas' : 'Gestor de Tareas'} | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <Modal title="Nueva Tarea" onClose={() => setIsModalOpen(false)}>
          {selectedProject !== 'all' ? (
            <TaskForm
              onCancel={() => setIsModalOpen(false)}
              project={projects.find(p => p.id === parseInt(selectedProject))}
              projectMembers={projectMembers}
              onTaskSaved={(newTask, isEditMode = false) => {
                if (isEditMode) {
                  setTasks((prev) => prev.map(task => 
                    task.id === newTask.id ? newTask : task
                  ));
                } else {
                  setTasks((prev) => [newTask, ...prev]);
                }
                setIsModalOpen(false);
                toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada exitosamente!');
              }}
            />
          ) : (
            <div className="p-4">
              <p className="text-warning">Por favor selecciona un proyecto primero</p>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
          )}
        </Modal>
      )}

      {selectedTask && (
        <Modal
          title={
            user && ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(user.role)
              ? 'Editar Tarea'
              : 'Detalles de la Tarea'
          }
          onClose={() => setSelectedTask(null)}
          size="large"
        >
          <TaskDetailsView
            task={selectedTask}
            user={user}
            onClose={() => setSelectedTask(null)}
            documents={taskDocuments[selectedTask.id] || []}
            onDocumentUpload={() => {
              getDocumentsByTask(selectedTask.id)
                .then(docs => {
                  setTaskDocuments(prev => ({
                    ...prev,
                    [selectedTask.id]: docs
                  }));
                })
                .catch(error => {
                  console.error('Error refreshing documents:', error);
                });
            }}
            onTaskUpdated={(updatedTask) => {
              setTasks((prev) => prev.map(task => 
                task.id === updatedTask.id ? updatedTask : task
              ));
            }}
            onTaskDeleted={(taskId) => {
              setTasks((prev) => prev.filter(task => task.id !== taskId));
              setSelectedTask(null);
            }}
          />
        </Modal>
      )}

      <div className="tasks-page animate-slide-up">
        <div className="page-header">
          <h1>
            {user.role === 'STUDENT' ? 'Mis Tareas' : 'Gestor de Tareas'}
          </h1>
          {['SUPERADMIN', 'ADMIN', 'CEO', 'RH'].includes(user.role) && (
            <button 
              className="btn btn-primary" 
              onClick={() => setIsModalOpen(true)}
              disabled={selectedProject === 'all'}
              title={selectedProject === 'all' ? 'Selecciona un proyecto primero' : 'Crear nueva tarea'}
            >
              + Nueva Tarea
            </button>
          )}
        </div>

        <div className="glass-card">
          <div className="filters-bar">
            <div className="filter-group">
              <FiFilter />
              <label htmlFor="project-filter">Filtrar por Proyecto:</label>
              <select
                id="project-filter"
                className="form-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="all">Todos los Proyectos</option>
                {Array.isArray(projects) &&
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="tasks-list-container">
            {Array.isArray(filteredTasks) && filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                const documents = taskDocuments[task.id] || [];
                
                return (
                  <div
                    key={task.id}
                    className="task-list-item"
                    onClick={() => setSelectedTask(task)}
                  >
                    <FiCheckSquare
                      className={`task-status-icon status-${task.status.toLowerCase()}`}
                    />
                    <div className="task-list-info">
                      <p className="task-title">{task.title}</p>
                      <span className="task-project-name">{task.project_name}</span>
                      {documents.length > 0 && (
                        <div className="task-documents-badge">
                          <FiPaperclip size={12} />
                          <span>{documents.length} documento(s)</span>
                        </div>
                      )}
                    </div>
                    <div className="task-list-details">
                      {task.due_date && (
                        <span className="task-due-date">
                          Vence:{' '}
                          {format(parseISO(task.due_date), 'dd MMM yyyy', { locale: es })}
                        </span>
                      )}
                      {task.assigned_to && (
                        <img
                          src={
                            task.assigned_to.profile_picture ||
                            `https://ui-avatars.com/api/?name=${task.assigned_to.first_name}+${task.assigned_to.last_name}&background=f97316&color=fff`
                          }
                          alt={task.assigned_to.first_name}
                          className="task-assignee-avatar"
                          title={`Asignada a ${task.assigned_to.first_name}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty-list-message">
                <h2>No hay tareas</h2>
                <p>No se encontraron tareas que coincidan con el filtro seleccionado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default TasksPage;