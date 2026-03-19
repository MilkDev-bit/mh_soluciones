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
import { format, parseISO, isPast, isFuture, addDays, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import './TasksPage.scss';

const TasksPage = () => {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // NUEVO: Estado para el filtro del Superadmin
  const [adminTaskFilter, setAdminTaskFilter] = useState('ALL'); 

  const { tasksUpdated, consumeTasksUpdate, notifyTaskChange } = useProjectContext();

  // Fetch user data with React Query
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUserFromSession,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000,
  });

  // Fetch tasks with React Query
  const { 
    data: tasksData, 
    isLoading: tasksLoading,
    isFetching: tasksFetching,
    refetch: refetchTasks 
  } = useQuery({
    queryKey: ['tasks', selectedProject, currentPage], 
    queryFn: () => getTasks(selectedProject, currentPage),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const tasksList = Array.isArray(data.results) ? data.results : [];
      
      // For students, filter to only show their assigned tasks
      if (user?.role === 'STUDENT') {
        const filteredTasks = tasksList.filter(task => {
          const isAssignedTo = task.assigned_to?.id === user.id;
          const isInAssignedStudents = Array.isArray(task.assigned_students_data) && 
            task.assigned_students_data.some(student => student.id === user.id);
          return isAssignedTo || isInAssignedStudents;
        });
        return { ...data, results: filteredTasks };
      }
      
      return { ...data, results: tasksList };
    },
    enabled: !!user, // Only fetch when user is available
  });

  // Fetch projects with React Query
  const { 
    data: projectsData,
    isLoading: projectsLoading 
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(), 
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (data) => {
      const projectsList = Array.isArray(data.results) ? data.results : [];
      
      // For students, filter to only show their projects
      if (user?.role === 'STUDENT') {
        return projectsList.filter(project => 
          project.members?.some(member => 
            member.user?.id === user.id || member.id === user.id
          )
        );
      }
      
      return projectsList;
    },
    enabled: !!user,
  });

  // Fetch project members when a project is selected
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

  // Memoize task IDs for stable query key
  const taskIds = useMemo(() => 
    tasks.map(t => t.id).sort().join(',') || '', 
    [tasks]
  );

  // Fetch documents for all tasks
  const { data: taskDocuments = {} } = useQuery({
    queryKey: ['taskDocuments', taskIds],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return {};
      
      const documentsPromises = tasks.map(async (task) => {
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
      
      return documentsMap;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!tasks && tasks.length > 0,
  });

  // Listen for task updates from other components
  useEffect(() => {
    if (tasksUpdated) {
      refetchTasks();
      consumeTasksUpdate();
    }
  }, [tasksUpdated, refetchTasks, consumeTasksUpdate]);

  const handleRefresh = useCallback(() => {
    refetchTasks();
  }, [refetchTasks]);

  const handleTaskCreated = useCallback((newTask, isEditMode = false) => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['taskDocuments'] });
    
    setIsModalOpen(false);
    notifyTaskChange(newTask.id, newTask.project, isEditMode ? 'update' : 'create');
    toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada exitosamente!');
  }, [queryClient, notifyTaskChange]);

  const handleTaskUpdated = useCallback((updatedTask) => {
    queryClient.invalidateQueries(['tasks']);
    queryClient.invalidateQueries(['taskDocuments']);
    notifyTaskChange(updatedTask.id, updatedTask.project, 'update');
  }, [queryClient, notifyTaskChange]);

  const handleTaskDeleted = useCallback((taskId) => {
    queryClient.invalidateQueries(['tasks']);
    queryClient.invalidateQueries(['taskDocuments']);
    setSelectedTask(null);
    notifyTaskChange(taskId, null, 'delete');
  }, [queryClient, notifyTaskChange]);

  const UPCOMING_DAYS_THRESHOLD = 7;
  
  const categorizeTasks = (tasksList) => {
    const now = new Date();
    const soon = addDays(now, UPCOMING_DAYS_THRESHOLD);

    return {
      upcoming: tasksList.filter(task => {
        if (!task.due_date || task.status === 'COMPLETED') return false;
        const dueDate = parseISO(task.due_date);
        return isFuture(dueDate) && isWithinInterval(dueDate, { start: now, end: soon });
      }),
      overdue: tasksList.filter(task => {
        if (!task.due_date || task.status === 'COMPLETED') return false;
        const dueDate = parseISO(task.due_date);
        return isPast(dueDate);
      }),
      completed: tasksList.filter(task => task.status === 'COMPLETED')
    };
  };

  // NUEVO: Lógica combinada para filtrar por proyecto Y por filtro de Superadmin
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // 1. Filtrar por proyecto si no es 'all'
    if (selectedProject !== 'all') {
      result = result.filter((task) => {
        const taskProjectId = typeof task.project === 'object' ? task.project.id : task.project;
        return String(taskProjectId) === String(selectedProject);
      });
    }

    // 2. Filtrar por botones del Superadmin (solo si es SUPERADMIN)
    if (user?.role === 'SUPERADMIN' && adminTaskFilter !== 'ALL') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      result = result.filter(task => {
        if (adminTaskFilter === 'PENDING') {
          return task.status === 'PENDING' || task.status === 'IN_PROGRESS' || task.status === 'OPEN';
        }
        if (adminTaskFilter === 'COMPLETED') {
          return task.status === 'COMPLETED' || task.status === 'CLOSED';
        }
        if (adminTaskFilter === 'THIS_WEEK') {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          return dueDate >= today && dueDate <= nextWeek;
        }
        return true;
      });
    }

    return result;
  }, [tasks, selectedProject, adminTaskFilter, user?.role]);

  const categorizedTasks = categorizeTasks(filteredTasks);

  if (loading || !user) {
    return <Loading fullscreen text="Cargando tareas..." />;
  }

  const TaskCard = ({ task }) => {
    const documents = taskDocuments[task.id] || [];
    
    return (
      <div
        className="task-card"
        onClick={() => setSelectedTask(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedTask(task);
          }
        }}
      >
        <div className="task-card-header">
          <div className="task-icon">
            <FiCheckSquare />
          </div>
          <h3 className="task-title">{task.title}</h3>
        </div>
        
        <div className="task-card-body">
          {task.description && (
            <p className="task-description">{task.description}</p>
          )}
          
          <div className="task-meta">
            <div className="task-project-badge">
              {task.project_name}
            </div>
            
            {task.due_date && (
              <div className="task-deadline">
                <FiCalendar />
                <span>{format(parseISO(task.due_date), 'dd MMM yyyy', { locale: es })}</span>
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
          {tasks.length}
        </span>
      </div>
      
      <div className="task-column-content">
        {tasks.length > 0 ? (
          tasks.map(task => <TaskCard key={task.id} task={task} />)
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
        <title>{isStudent(user.role) ? 'Mis Tareas' : 'Gestor de Tareas'} | MH Soluciones</title>
      </Helmet>

      {isModalOpen && (
        <Modal 
          title="Nueva Tarea" 
          onClose={() => setIsModalOpen(false)}
        >
          {selectedProject !== 'all' ? (
            <TaskForm
              onCancel={() => setIsModalOpen(false)}
              project={projects.find(p => p.id === parseInt(selectedProject))}
              projectMembers={projectMembers}
              onTaskSaved={handleTaskCreated}
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
          title="Detalles de la Tarea"
          onClose={() => setSelectedTask(null)}
          size="large"
        >
          <TaskDetailsView
            task={selectedTask}
            user={user}
            onClose={() => setSelectedTask(null)}
            documents={taskDocuments[selectedTask.id] || []}
            onDocumentUpload={() => {
              queryClient.invalidateQueries(['taskDocuments']);
            }}
            onTaskUpdated={handleTaskUpdated}
            onTaskDeleted={handleTaskDeleted}
          />
        </Modal>
      )}

      <div className="tasks-page animate-slide-up">
        <div className="page-header">
          <div className="header-content">
            <h1>{isStudent(user.role) ? 'Mis Tareas' : 'Gestor de Tareas'}</h1>
          </div>
          <div className="header-actions">
            {isRefreshing && (
              <Loading inline size="small" text="Actualizando..." />
            )}
            <button
              className="btn btn-secondary btn-icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Actualizar lista de tareas"
              title="Actualizar"
            >
              <FiRefreshCw className={isRefreshing ? 'spinning' : ''} />
            </button>
            {canCreateTasks(user.role) && (
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
        </div>

        <div className="glass-card">
          <div className="filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            
            {/* Select original de Proyectos */}
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
                {Array.isArray(projects) &&
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* NUEVO: Botones de filtro rápidos solo para SUPERADMIN */}
            {user?.role === 'SUPERADMIN' && (
              <div className="admin-filters" style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('ALL')}
                >
                  Todas
                </button>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('PENDING')}
                >
                  Pendientes
                </button>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('COMPLETED')}
                >
                  Completadas
                </button>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'THIS_WEEK' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('THIS_WEEK')}
                >
                  Esta Semana
                </button>
              </div>
            )}
          </div>

          {isStudent(user.role) ? (
            // Student view - Board with 3 columns
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
            // Non-student view (Task creators/reviewers) - List view
            <div className="tasks-list">
              {filteredTasks.length > 0 ? (
                <div className="tasks-list-container">
                  {filteredTasks.map(task => (
                    <div
                      key={task.id}
                      className="task-list-item"
                      onClick={() => setSelectedTask(task)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedTask(task);
                        }
                      }}
                    >
                      <div className="task-list-item-content">
                        <div className="task-list-header">
                          <div className="task-icon">
                            <FiCheckSquare />
                          </div>
                          <h3 className="task-title">{task.title}</h3>
                          <div className={`task-status-badge status-${task.status.toLowerCase()}`}>
                            {task.status === 'COMPLETED' ? 'Completada' : 
                             task.status === 'IN_PROGRESS' ? 'En Progreso' : 'Pendiente'}
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="task-description">{task.description}</p>
                        )}
                        
                        <div className="task-list-meta">
                          <div className="task-project-badge">
                            {task.project_name}
                          </div>
                          
                          {task.due_date && (
                            <div className="task-meta-item">
                              <FiCalendar />
                              <span>{format(parseISO(task.due_date), 'dd MMM yyyy', { locale: es })}</span>
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
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <FiCheckSquare size={48} />
                  <p>No hay tareas disponibles</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pagination-bar">
        <button 
          className="btn btn-secondary"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(prev => prev - 1)}
        >
          Anterior
        </button>
        
        <span className="page-info">
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
    </>
  );
};

export default TasksPage;