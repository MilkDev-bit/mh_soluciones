import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getTasks, duplicateTask } from '../../services/taskService';
import { getProjects, getProjectMembers } from '../../services/projectService';
import { getCurrentUserFromSession } from '../../services/userService';
import { getDocumentsByProject } from '../../services/documentService';
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
  FiPaperclip,
  FiCopy,
  FiInbox,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';
import AvatarGroup from '../../components/common/AvatarGroup';
import {
  taskStatusLabel, taskStatusClass, taskDeadlineLabel, taskDeadlineDate, isTaskDone,
  WINDOW_STATE, TONE_COLORS,
} from '../../utils/taskStatus';
import './TasksPage.scss';
import { visibleDescription } from '../../utils/taskDescription';

const TASKS_PAGE_SIZE = 20;

const TaskCard = ({ task, taskDocuments, setSelectedTask }) => {
  const documents = taskDocuments?.[task.id] || [];

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
        {visibleDescription(task.description) && (
          <p className="task-description">{visibleDescription(task.description)}</p>
        )}

        <div className="task-meta">
          <div className="task-project-badge">
            {task.project_name}
          </div>

          {task._formattedDate && (
            <div className="task-deadline">
              <FiCalendar />
              <span>{task._formattedDate}</span>
            </div>
          )}

          {task.my_window && (() => {
            const meta = WINDOW_STATE[task.my_window.state];
            const colors = TONE_COLORS[meta?.tone || 'info'];
            return (
              <div
                className="task-window-chip"
                title={task.my_window.message}
                style={{ background: colors.bg, color: colors.text, borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}
              >
                {meta?.label || task.my_window.state}
              </div>
            );
          })()}

          {(task.assigned_students_data?.length > 0 || task.assigned_to) && (
            <div className="task-assignee">
              <AvatarGroup
                students={
                  task.assigned_students_data?.length > 0
                    ? task.assigned_students_data
                    : task.assigned_to
                    ? [task.assigned_to]
                    : []
                }
                size={26}
              />
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

const TaskColumn = ({ title, icon: Icon, tasks, emptyMessage, color, taskDocuments, setSelectedTask }) => (
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
        tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            taskDocuments={taskDocuments} 
            setSelectedTask={setSelectedTask} 
          />
        ))
      ) : (
        <div className="empty-state">
          <Icon size={48} />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  </div>
);

const TasksPage = () => {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // NUEVO: Estado para el filtro del Superadmin
  const [adminTaskFilter, setAdminTaskFilter] = useState('ALL');
  const [duplicatingTaskId, setDuplicatingTaskId] = useState(null);

  const handleDuplicateTask = async (taskId, e) => {
    e.stopPropagation();
    setDuplicatingTaskId(taskId);
    try {
      await duplicateTask(taskId);
      toast.success('Tarea duplicada exitosamente');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (err) {
      toast.error(err?.message || 'Error al duplicar la tarea');
    } finally {
      setDuplicatingTaskId(null);
    }
  };

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

  // Total de páginas a partir del `count` de DRF (page_size = 20 en
  // apps/core/pagination.py).
  const totalPages = tasksData?.count
    ? Math.max(1, Math.ceil(tasksData.count / TASKS_PAGE_SIZE))
    : 0;

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

  // Fetch documents for all tasks — batched by project to avoid N+1
  const { data: taskDocuments = {} } = useQuery({
    queryKey: ['taskDocuments', taskIds, selectedProject],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return {};

      if (selectedProject !== 'all') {
        // Single project selected — one API call
        const ids = tasks.map(t => t.id);
        return await getDocumentsByProject(selectedProject, ids);
      }

      // All projects — group tasks by project, one call per unique project
      const projectTasksMap = {};
      tasks.forEach(task => {
        const pid = typeof task.project === 'object' ? task.project?.id : task.project;
        if (!pid) return;
        if (!projectTasksMap[pid]) projectTasksMap[pid] = [];
        projectTasksMap[pid].push(task.id);
      });

      const results = await Promise.all(
        Object.entries(projectTasksMap).map(([pid, tids]) =>
          getDocumentsByProject(pid, tids)
        )
      );

      // Merge all per-project maps into one flat map
      return Object.assign({}, ...results);
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
          return !isTaskDone(task) && task.status !== 'DRAFT';
        }
        if (adminTaskFilter === 'TO_REVIEW') {
          return (task.pending_review_count || 0) > 0;
        }
        if (adminTaskFilter === 'OVERDUE') {
          return task.is_overdue;
        }
        if (adminTaskFilter === 'COMPLETED') {
          return isTaskDone(task);
        }
        if (adminTaskFilter === 'THIS_WEEK') {
          // [FIX] new Date('2026-11-15') se interpreta en UTC (= 14/11 18:00 en México)
          const dueDate = taskDeadlineDate(task);
          if (!dueDate) return false;
          return dueDate >= today && dueDate <= nextWeek;
        }
        return true;
      });
    }

    return result;
  }, [tasks, selectedProject, adminTaskFilter, user?.role]);

  // El servidor decide si vence (deadline, is_overdue, my_window). Antes se usaba
  // isPast(due_date), que vencía la tarea a las 00:00 del día límite, y GRAFICAS
  // aparecía en "Próximamente" y en "Vencidas" al mismo tiempo.
  const processedTasks = useMemo(() => filteredTasks.map(task => ({
    ...task,
    _isOverdue: Boolean(task.is_overdue),
    _formattedDate: taskDeadlineLabel(task),
  })), [filteredTasks]);

  const categorizedTasks = useMemo(() => {
    const buckets = { pending: [], overdue: [], submitted: [], completed: [] };
    processedTasks.forEach(task => {
      const w = task.my_window;
      if (!w) {
        // Sin información por alumno (API antigua): usar los campos del servidor
        if (isTaskDone(task)) buckets.completed.push(task);
        else if (task.is_overdue) buckets.overdue.push(task);
        else buckets.pending.push(task);
        return;
      }
      switch (w.state) {
        case 'APPROVED':
          buckets.completed.push(task);
          break;
        case 'IN_REVIEW':
          buckets.submitted.push(task);
          break;
        case 'OVERDUE':
        case 'CLOSED':
          (task.my_submission_status ? buckets.submitted : buckets.overdue).push(task);
          break;
        default: {
          // OPEN / DUE_SOON / NO_DEADLINE / LATE_WINDOW / CORRECTION / NOT_OPEN
          if (task.my_submission_status === 'SUBMITTED' && w.state !== 'CORRECTION') {
            buckets.submitted.push(task);
          } else {
            buckets.pending.push(task);
          }
        }
      }
    });
    // Lo urgente primero: correcciones, tardías, vence pronto; después por fecha
    const priority = { CORRECTION: 0, LATE_WINDOW: 1, DUE_SOON: 2, OPEN: 3, NOT_OPEN: 4, NO_DEADLINE: 5 };
    buckets.pending.sort((a, b) => {
      const pa = priority[a.my_window?.state] ?? 9;
      const pb = priority[b.my_window?.state] ?? 9;
      if (pa !== pb) return pa - pb;
      const da = taskDeadlineDate(a)?.getTime() ?? Infinity;
      const db = taskDeadlineDate(b)?.getTime() ?? Infinity;
      return da - db;
    });
    return buckets;
  }, [processedTasks]);

  if (loading || !user) {
    return <Loading fullscreen text="Cargando tareas..." />;
  }



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
                  className={`btn btn-sm ${adminTaskFilter === 'TO_REVIEW' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('TO_REVIEW')}
                >
                  Por revisar
                </button>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'OVERDUE' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('OVERDUE')}
                >
                  Vencidas
                </button>
                <button 
                  className={`btn btn-sm ${adminTaskFilter === 'COMPLETED' ? 'btn-primary' : 'btn-secondary'}`} 
                  onClick={() => setAdminTaskFilter('COMPLETED')}
                >
                  Cerradas
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
            <div className="tasks-board tasks-board--four">
              <TaskColumn
                title="Por entregar"
                icon={FiClock}
                tasks={categorizedTasks.pending}
                emptyMessage="No tienes tareas pendientes"
                color="#f59e0b"
                taskDocuments={taskDocuments}
                setSelectedTask={setSelectedTask}
              />

              <TaskColumn
                title="Vencidas"
                icon={FiAlertCircle}
                tasks={categorizedTasks.overdue}
                emptyMessage="No hay tareas vencidas"
                color="#ef4444"
                taskDocuments={taskDocuments}
                setSelectedTask={setSelectedTask}
              />

              <TaskColumn
                title="Entregadas"
                icon={FiInbox}
                tasks={categorizedTasks.submitted}
                emptyMessage="No hay entregas en revisión"
                color="#3b82f6"
                taskDocuments={taskDocuments}
                setSelectedTask={setSelectedTask}
              />

              <TaskColumn
                title="Aprobadas"
                icon={FiCheckCircle}
                tasks={categorizedTasks.completed}
                emptyMessage="Aún no tienes entregas aprobadas"
                color="#10b981"
                taskDocuments={taskDocuments}
                setSelectedTask={setSelectedTask}
              />
            </div>
          ) : (
            // Non-student view (Task creators/reviewers) - List view
            <div className="tasks-list">
              {processedTasks.length > 0 ? (
                <div className="tasks-list-container">
                  {processedTasks.map(task => (
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
                          <div className={`task-status-badge status-${task.status.toLowerCase()} ${taskStatusClass(task.status)}`}>
                            {taskStatusLabel(task)}
                          </div>
                          {task._isOverdue && (
                            <div className="task-status-badge status-overdue" style={{ background: '#fee2e2', color: '#991b1b' }}>Vencida</div>
                          )}
                          {task.is_continuous && (
                            <div className="task-status-badge" style={{ background: '#e0f2fe', color: '#075985' }}>Continua</div>
                          )}
                          {task.pending_review_count > 0 && (
                            <div className="task-status-badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                              {task.pending_review_count} por revisar
                            </div>
                          )}
                          {(isTaskDone(task) || task._isOverdue) && user?.role === 'SUPERADMIN' && (
                            <button
                              className="btn btn-sm btn-secondary"
                              title="Duplicar tarea"
                              disabled={duplicatingTaskId === task.id}
                              onClick={(e) => handleDuplicateTask(task.id, e)}
                              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <FiCopy size={14} />
                              {duplicatingTaskId === task.id ? 'Duplicando...' : 'Duplicar'}
                            </button>
                          )}
                        </div>
                        
                        {visibleDescription(task.description) && (
                          <p className="task-description">{visibleDescription(task.description)}</p>
                        )}
                        
                        <div className="task-list-meta">
                          <div className="task-project-badge">
                            {task.project_name}
                          </div>
                          
                          {task._formattedDate && (
                            <div className="task-meta-item">
                              <FiCalendar />
                              <span>{task._formattedDate}</span>
                            </div>
                          )}
                          
                          {(task.assigned_students_data?.length > 0 || task.assigned_to) && (
                            <div className="task-meta-item">
                              <AvatarGroup
                                students={
                                  task.assigned_students_data?.length > 0
                                    ? task.assigned_students_data
                                    : task.assigned_to
                                    ? [task.assigned_to]
                                    : []
                                }
                                size={26}
                              />
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

          {/* Paginación dentro de la tarjeta, debajo de la lista. Solo se
              muestra cuando hay más de una página. */}
          {(currentPage > 1 || tasksData?.next) && (
            <div className="pagination-bar">
              <button
                className="btn btn-sm btn-secondary"
                disabled={currentPage === 1 || tasksFetching}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <FiChevronLeft /> Anterior
              </button>

              <span className="page-info">
                Página <strong>{currentPage}</strong>
                {totalPages > 1 && <> de <strong>{totalPages}</strong></>}
                {typeof tasksData?.count === 'number' && (
                  <span className="page-info-total"> · {tasksData.count} tareas</span>
                )}
              </span>

              <button
                className="btn btn-sm btn-secondary"
                disabled={!tasksData?.next || tasksFetching}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TasksPage;