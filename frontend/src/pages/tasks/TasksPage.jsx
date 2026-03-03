import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getTasks } from '../../services/taskService';
import { getProjects, getProjectMembers } from '../../services/projectService';
import { getCurrentUserFromSession } from '../../services/userService';
import { getDocumentsByTask } from '../../services/documentService';
import { useProjectContext } from '../../contexts/ProjectContext';
import { isStudent, canCreateTasks } from '../../constants/roles';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import TaskForm from '../../components/tasks/TaskForm';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import { 
  FiCheckSquare, 
  FiFilter, 
  FiRefreshCw,
  FiClock,
  FiAlertCircle,
  FiCheckCircle,
  FiCalendar,
  FiUser,
  FiPaperclip
} from 'react-icons/fi';
// IMPORTANTE: Se agregó isValid para prevenir crasheos por fechas corruptas
import { format, parseISO, isPast, isFuture, addDays, isWithinInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import './TasksPage.scss';

const TasksPage = () => {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const { tasksUpdated, consumeTasksUpdate, notifyTaskChange } = useProjectContext();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserFromSession,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const { 
    data: tasksData, 
    isLoading: tasksLoading,
    isFetching: tasksFetching,
    refetch: refetchTasks 
  } = useQuery({
    queryKey: ['tasks', selectedProject, currentPage], 
    queryFn: () => getTasks(selectedProject, currentPage),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      let tasksList = Array.isArray(data?.results) ? data.results : [];
      
      if (user?.role === 'STUDENT') {
        tasksList = tasksList.filter(task => {
          const isAssignedTo = task?.assigned_to?.id === user?.id;
          const isInAssignedStudents = Array.isArray(task?.assigned_students_data) && 
            task.assigned_students_data.some(student => student?.id === user?.id);
          return isAssignedTo || isInAssignedStudents;
        });
      }
      
      return {
        results: tasksList,
        next: data?.next,
        previous: data?.previous,
        count: data?.count
      };
    },
    enabled: !!user,
  });

  const { 
    data: projectsData,
    isLoading: projectsLoading 
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const projectsList = Array.isArray(data?.results) ? data.results : [];
      
      if (user?.role === 'STUDENT') {
        return projectsList.filter(project => 
          project?.members?.some(member => 
            member?.user?.id === user?.id || member?.id === user?.id
          )
        );
      }
      return projectsList;
    },
    enabled: !!user,
  });

  const { data: projectMembers = [] } = useQuery({
    queryKey: ['projectMembers', selectedProject],
    queryFn: () => getProjectMembers(selectedProject),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: selectedProject !== 'all',
  });

  const tasks = tasksData?.results || [];
  const projects = projectsData || [];
  const loading = tasksLoading || projectsLoading;
  const isRefreshing = tasksFetching;

  const taskIds = useMemo(() => 
    tasks.map(t => t?.id).filter(Boolean).sort().join(',') || '', 
    [tasks]
  );

  const { data: taskDocuments = {} } = useQuery({
    queryKey: ['taskDocuments', taskIds],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return {};
      
      const documentsPromises = tasks.map(async (task) => {
        if (!task?.id) return { taskId: null, documents: [] };
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
        if (result.taskId) documentsMap[result.taskId] = result.documents;
      });
      
      return documentsMap;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tasks && tasks.length > 0,
  });

  useEffect(() => {
    if (tasksUpdated) {
      refetchTasks();
      consumeTasksUpdate();
    }
  }, [tasksUpdated, refetchTasks, consumeTasksUpdate]);

  const handleRefresh = useCallback(() => refetchTasks(), [refetchTasks]);

  const handleTaskCreated = useCallback((newTask, isEditMode = false) => {
    queryClient.invalidateQueries(['tasks']);
    queryClient.invalidateQueries(['taskDocuments']);
    setIsModalOpen(false);
    notifyTaskChange(newTask?.id, newTask?.project, isEditMode ? 'update' : 'create');
    toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada exitosamente!');
  }, [queryClient, notifyTaskChange]);

  const handleTaskUpdated = useCallback((updatedTask) => {
    queryClient.invalidateQueries(['tasks']);
    queryClient.invalidateQueries(['taskDocuments']);
    notifyTaskChange(updatedTask?.id, updatedTask?.project, 'update');
  }, [queryClient, notifyTaskChange]);

  const handleTaskDeleted = useCallback((taskId) => {
    queryClient.invalidateQueries(['tasks']);
    queryClient.invalidateQueries(['taskDocuments']);
    setSelectedTask(null);
    notifyTaskChange(taskId, null, 'delete');
  }, [queryClient, notifyTaskChange]);

  // Función segura para formatear fechas sin crashear
  const renderSafeDate = (dateString) => {
    if (!dateString) return null;
    const parsedDate = parseISO(dateString);
    if (!isValid(parsedDate)) return 'Fecha inválida';
    return format(parsedDate, 'dd MMM yyyy', { locale: es });
  };

  const UPCOMING_DAYS_THRESHOLD = 7;
  
  const categorizeTasks = (tasksList) => {
    const now = new Date();
    const soon = addDays(now, UPCOMING_DAYS_THRESHOLD);

    return {
      upcoming: tasksList.filter(task => {
        if (!task?.due_date || task?.status === 'COMPLETED') return false;
        const dueDate = parseISO(task.due_date);
        return isValid(dueDate) && isFuture(dueDate) && isWithinInterval(dueDate, { start: now, end: soon });
      }),
      overdue: tasksList.filter(task => {
        if (!task?.due_date || task?.status === 'COMPLETED') return false;
        const dueDate = parseISO(task.due_date);
        return isValid(dueDate) && isPast(dueDate);
      }),
      completed: tasksList.filter(task => task?.status === 'COMPLETED')
    };
  };

  const filteredTasks = useMemo(() => {
    if (selectedProject === 'all') return tasks;
    return tasks.filter((task) => {
      // Validación estricta para evitar error al leer properties de null
      const taskProjectId = (task?.project && typeof task.project === 'object') 
        ? task.project.id 
        : task?.project;
      return String(taskProjectId) === String(selectedProject);
    });
  }, [tasks, selectedProject]);

  const categorizedTasks = categorizeTasks(filteredTasks);

  if (loading || !user) {
    return <Loading fullscreen text="Cargando tareas..." />;
  }

  const TaskCard = ({ task }) => {
    if (!task) return null;
    const documents = taskDocuments[task.id] || [];
    
    return (
      <div
        className="task-card"
        onClick={() => setSelectedTask(task)}
        role="button"
        tabIndex={0}
      >
        <div className="task-card-header">
          <div className="task-icon"><FiCheckSquare /></div>
          <h3 className="task-title">{task.title || 'Sin título'}</h3>
        </div>
        
        <div className="task-card-body">
          {task.description && <p className="task-description">{task.description}</p>}
          
          <div className="task-meta">
            {task.project_name && <div className="task-project-badge">{task.project_name}</div>}
            
            {task.due_date && (
              <div className="task-deadline">
                <FiCalendar />
                <span>{renderSafeDate(task.due_date)}</span>
              </div>
            )}
            
            {task.assigned_to && (
              <div className="task-assignee">
                <FiUser />
                <span>{task.assigned_to.first_name} {task.assigned_to.last_name}</span>
              </div>
            )}
            
            {documents.length > 0 && (
              <div className="task-documents">
                <FiPaperclip />
                <span>{documents.length} archivo(s)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TaskColumn = ({ title, icon: Icon, tasks, emptyMessage, color }) => (
    <div className="task-column">
      <div className="task-column-header" style={{ borderColor: color }}>
        <Icon style={{ color }} />
        <h2>{title}</h2>
        <span className="task-count" style={{ backgroundColor: color }}>
          {Array.isArray(tasks) ? tasks.length : 0}
        </span>
      </div>
      <div className="task-column-content">
        {Array.isArray(tasks) && tasks.length > 0 ? (
          tasks.map(task => <TaskCard key={task?.id || Math.random()} task={task} />)
        ) : (
          <div className="empty-state">
            <Icon size={48} />
            <p>{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{isStudent(user?.role) ? 'Mis Tareas' : 'Gestor de Tareas'} | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <Modal title="Nueva Tarea" onClose={() => setIsModalOpen(false)}>
          {selectedProject !== 'all' ? (
            <TaskForm
              onCancel={() => setIsModalOpen(false)}
              // Comparación segura como String en lugar de parseInt
              project={projects.find(p => String(p?.id) === String(selectedProject))}
              projectMembers={projectMembers}
              onTaskSaved={handleTaskCreated}
            />
          ) : (
            <div className="p-4">
              <p className="text-warning">Por favor selecciona un proyecto primero</p>
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cerrar
              </button>
            </div>
          )}
        </Modal>
      )}

      {selectedTask && (
        <Modal title="Detalles de la Tarea" onClose={() => setSelectedTask(null)} size="large">
          <TaskDetailsView
            task={selectedTask}
            user={user}
            onClose={() => setSelectedTask(null)}
            documents={taskDocuments[selectedTask?.id] || []}
            onDocumentUpload={() => queryClient.invalidateQueries(['taskDocuments'])}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
          />
        </Modal>
      )}

      <div className="tasks-page animate-slide-up">
        <div className="page-header">
          <div className="header-content">
            <h1>{isStudent(user?.role) ? 'Mis Tareas' : 'Gestor de Tareas'}</h1>
          </div>
          <div className="header-actions">
            {isRefreshing && <Loading inline size="small" text="Actualizando..." />}
            <button
              className="btn btn-secondary btn-icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <FiRefreshCw className={isRefreshing ? 'spinning' : ''} />
            </button>
            {canCreateTasks(user?.role) && (
              <button 
                className="btn btn-primary" 
                onClick={() => setIsModalOpen(true)}
                disabled={selectedProject === 'all'}
              >
                + Nueva Tarea
              </button>
            )}
          </div>
        </div>

        <div className="glass-card" style={{ opacity: isFetching ? 0.7 : 1, transition: 'opacity 0.2s' }}>
          <div className="filters-bar">
            <div className="filter-group">
              <FiFilter />
              <label htmlFor="project-filter">Filtrar por Proyecto:</label>
              <select
                id="project-filter"
                className="form-select"
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">Todos los Proyectos</option>
                {Array.isArray(projects) && projects.map((project) => (
                  <option key={project?.id || Math.random()} value={project?.id}>
                    {project?.name || 'Proyecto sin nombre'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isStudent(user?.role) ? (
            <div className="tasks-board">
              <TaskColumn
                title="Próximamente"
                icon={FiClock}
                tasks={categorizedTasks.upcoming}
                emptyMessage="No hay tareas próximas"
                color="#f59e0b"
              />
              <TaskColumn
                title="Vencidas"
                icon={FiAlertCircle}
                tasks={categorizedTasks.overdue}
                emptyMessage="No hay tareas vencidas"
                color="#ef4444"
              />
              <TaskColumn
                title="Completadas"
                icon={FiCheckCircle}
                tasks={categorizedTasks.completed}
                emptyMessage="No hay tareas completadas"
                color="#10b981"
              />
            </div>
          ) : (
            <div className="tasks-list">
              {filteredTasks.length > 0 ? (
                <div className="tasks-list-container">
                  {filteredTasks.map(task => {
                    if (!task) return null;
                    // Se asegura el status para evitar .toLowerCase() en un null
                    const statusVal = task.status || 'PENDING';
                    
                    return (
                      <div
                        key={task.id || Math.random()}
                        className="task-list-item"
                        onClick={() => setSelectedTask(task)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="task-list-item-content">
                          <div className="task-list-header">
                            <div className="task-icon"><FiCheckSquare /></div>
                            <h3 className="task-title">{task.title || 'Sin título'}</h3>
                            <div className={`task-status-badge status-${statusVal.toLowerCase()}`}>
                              {statusVal === 'COMPLETED' ? 'Completada' : 
                               statusVal === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente'}
                            </div>
                          </div>
                          
                          {task.description && <p className="task-description">{task.description}</p>}
                          
                          <div className="task-list-meta">
                            {task.project_name && <div className="task-project-badge">{task.project_name}</div>}
                            
                            {task.due_date && (
                              <div className="task-meta-item">
                                <FiCalendar />
                                <span>{renderSafeDate(task.due_date)}</span>
                              </div>
                            )}
                            
                            {task.assigned_to && (
                              <div className="task-meta-item">
                                <FiUser />
                                <span>{task.assigned_to.first_name} {task.assigned_to.last_name}</span>
                              </div>
                            )}
                            
                            {taskDocuments[task.id] && taskDocuments[task.id].length > 0 && (
                              <div className="task-meta-item">
                                <FiPaperclip />
                                <span>{taskDocuments[task.id].length} archivo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <FiCheckSquare size={48} />
                  <p>No hay tareas disponibles en esta página o proyecto.</p>
                </div>
              )}
            </div>
          )}

          <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1.5rem', padding: '1rem 0' }}>
            <button 
              className="btn btn-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              Anterior
            </button>
            
            <span className="page-info" style={{ display: 'flex', alignItems: 'center' }}>
              Página <strong>{currentPage}</strong>
            </span>

            <button 
              className="btn btn-secondary"
              disabled={!tasksData?.next}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TasksPage;