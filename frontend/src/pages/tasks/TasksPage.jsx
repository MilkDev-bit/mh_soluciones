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
import TableSkeleton from '../../components/skeletons/TableSkeleton';
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
import { 
  format, 
  parseISO, 
  isPast, 
  isFuture, 
  addDays, 
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  isToday as checkIsToday
} from 'date-fns';
import { es } from 'date-fns/locale';
import './TasksPage.scss';

const TasksPage = () => {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('all');
  const [filtroFecha, setFiltroFecha] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [taskDocuments, setTaskDocuments] = useState({});

  const { tasksUpdated, consumeTasksUpdate, notifyTaskChange } = useProjectContext();

  const fetchData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const [userData, tasksData, projectsData] = await Promise.all([
        getCurrentUserFromSession(),
        getTasks(),
        getProjects(),
      ]);

      setUser(userData);
      const tasksList = Array.isArray(tasksData.results) ? tasksData.results : [];
      
      // For students, filter to only show their assigned tasks
      let filteredTasks = tasksList;
      if (userData.role === 'STUDENT') {
        filteredTasks = tasksList.filter(task => {
          const isAssignedTo = task.assigned_to?.id === userData.id;
          const isInAssignedStudents = Array.isArray(task.assigned_students_data) && 
            task.assigned_students_data.some(student => student.id === userData.id);
          return isAssignedTo || isInAssignedStudents;
        });
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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tasksUpdated) {
      fetchData(true);
      consumeTasksUpdate();
    }
  }, [tasksUpdated, fetchData, consumeTasksUpdate]);

  useEffect(() => {
    const handleTaskChange = () => {
      fetchData(true);
    };
    window.addEventListener('tasksUpdated', handleTaskChange);
    return () => window.removeEventListener('tasksUpdated', handleTaskChange);
  }, [fetchData]);

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

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const handleTaskCreated = useCallback((newTask, isEditMode = false) => {
    if (isEditMode) {
      setTasks(prev => prev.map(task => 
        task.id === newTask.id ? newTask : task
      ));
    } else {
      setTasks(prev => [newTask, ...prev]);
    }
    setIsModalOpen(false);
    notifyTaskChange(newTask.id, newTask.project, isEditMode ? 'update' : 'create');
    toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada exitosamente!');
  }, [notifyTaskChange]);

  const handleTaskUpdated = useCallback((updatedTask) => {
    setTasks(prev => prev.map(task => 
      task.id === updatedTask.id ? updatedTask : task
    ));
    notifyTaskChange(updatedTask.id, updatedTask.project, 'update');
  }, [notifyTaskChange]);

  const handleTaskDeleted = useCallback((taskId) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setSelectedTask(null);
    notifyTaskChange(taskId, null, 'delete');
  }, [notifyTaskChange]);

  const handleFechaFilterChange = (value) => {
    setFiltroFecha(value);
    // Reset custom dates when changing to predefined filters
    if (value !== 'custom') {
      setFechaDesde('');
      setFechaHasta('');
    }
  };

  const aplicarFiltroFecha = useCallback((tasksList) => {
    if (filtroFecha === 'all') return tasksList;

    const hoy = new Date();

    // Validate custom date range if both dates are provided
    if (filtroFecha === 'custom' && fechaDesde && fechaHasta) {
      const desde = parseISO(fechaDesde);
      const hasta = parseISO(fechaHasta);
      
      if (desde > hasta) {
        toast.error('La fecha "desde" no puede ser posterior a la fecha "hasta"');
        return tasksList; // Return all tasks if validation fails
      }
    }

    return tasksList.filter(task => {
      if (!task.due_date) return false; // Excluir tareas sin fecha de vencimiento
      
      const fechaVencimiento = parseISO(task.due_date);

      switch(filtroFecha) {
        case 'today':
          return checkIsToday(fechaVencimiento);
        
        case 'week':
          return isWithinInterval(fechaVencimiento, {
            start: startOfWeek(hoy, { weekStartsOn: 1 }), // Lunes
            end: endOfWeek(hoy, { weekStartsOn: 1 })
          });
        
        case 'month':
          return isWithinInterval(fechaVencimiento, {
            start: startOfMonth(hoy),
            end: endOfMonth(hoy)
          });
        
        case 'next7':
          return isWithinInterval(fechaVencimiento, {
            start: startOfDay(hoy),
            end: endOfDay(addDays(hoy, 7))
          });
        
        case 'next30':
          return isWithinInterval(fechaVencimiento, {
            start: startOfDay(hoy),
            end: endOfDay(addDays(hoy, 30))
          });
        
        case 'overdue':
          return isPast(endOfDay(fechaVencimiento)) && task.status !== 'COMPLETED';
        
        case 'custom':
          if (!fechaDesde && !fechaHasta) return true;
          
          if (fechaDesde && fechaHasta) {
            const desde = parseISO(fechaDesde);
            const hasta = parseISO(fechaHasta);
            
            return isWithinInterval(fechaVencimiento, {
              start: startOfDay(desde),
              end: endOfDay(hasta)
            });
          }
          
          if (fechaDesde) {
            return fechaVencimiento >= startOfDay(parseISO(fechaDesde));
          }
          
          if (fechaHasta) {
            return fechaVencimiento <= endOfDay(parseISO(fechaHasta));
          }
          
          return true;
        
        default:
          return true;
      }
    });
  }, [filtroFecha, fechaDesde, fechaHasta]);

  // Categorize tasks based on Microsoft Teams style
  // Tasks are categorized into 3 groups:
  // - Upcoming: Tasks due within the next 7 days (configurable)
  // - Overdue: Tasks past their due date
  // - Completed: All completed tasks
  const UPCOMING_DAYS_THRESHOLD = 7;
  
  const categorizeTasks = (tasksList) => {
    const now = new Date();
    const soon = addDays(now, UPCOMING_DAYS_THRESHOLD);

    return {
      upcoming: tasksList.filter(task => {
        if (!task.due_date || task.status === 'COMPLETED') return false;
        const dueDate = parseISO(task.due_date);
        // Include all future tasks (not just within 7 days) to ensure no tasks are hidden
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

  const filteredTasks = useMemo(() => {
    // Primero aplicar filtro de proyecto
    let tasksFiltered = selectedProject === 'all'
      ? tasks
      : tasks.filter((task) => task.project === parseInt(selectedProject));
    
    // Luego aplicar filtro de fecha
    tasksFiltered = aplicarFiltroFecha(tasksFiltered);
    
    return tasksFiltered;
  }, [tasks, selectedProject, filtroFecha, fechaDesde, fechaHasta]);

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

            <div className="filter-group">
              <FiCalendar />
              <label htmlFor="date-filter">Filtrar por Fecha:</label>
              <select
                id="date-filter"
                className="form-select"
                value={filtroFecha}
                onChange={(e) => handleFechaFilterChange(e.target.value)}
              >
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="next7">Próximos 7 días</option>
                <option value="next30">Próximos 30 días</option>
                <option value="overdue">Vencidas</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>

            {filtroFecha === 'custom' && (
              <div className="filter-group custom-date-filters">
                <label htmlFor="fecha-desde">Desde:</label>
                <input
                  type="date"
                  id="fecha-desde"
                  className="form-control"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                />
                <label htmlFor="fecha-hasta">Hasta:</label>
                <input
                  type="date"
                  id="fecha-hasta"
                  className="form-control"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                />
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
    </>
  );
};

export default TasksPage;
