import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCompletedTasks } from '../../services/completedTasksService';
import { getProjects } from '../../services/projectService';
import { getCurrentUserFromSession } from '../../services/userService';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import TaskDetailsView from '../tasks/TaskDetailsView';
import { 
  FiCheckCircle, 
  FiFilter, 
  FiCalendar,
  FiClock,
  FiAlertTriangle,
  FiCheck,
  FiX,
  FiDownload,
  FiEye
} from 'react-icons/fi';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import './CompletedTasksPage.scss';

const CompletedTasksPage = () => {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterProject, setFilterProject] = useState(searchParams.get('project') || 'all');
  const [stats, setStats] = useState({
    total: 0,
    onTime: 0,
    delayed: 0,
    averageDelay: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [userData, projectsData] = await Promise.all([
          getCurrentUserFromSession(),
          getProjects(),
        ]);

        setUser(userData);
        setProjects(
          Array.isArray(projectsData?.results) ? projectsData.results :
          Array.isArray(projectsData) ? projectsData : []
        );

        const allowedRoles = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'PROFESSOR', 'CEO', 'RH'];
        if (!allowedRoles.includes(userData.role)) {
          toast.error('No tienes permisos para acceder a esta página');
          return;
        }

        await loadCompletedTasks(filterProject);
        
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
    if (user) {
      loadCompletedTasks(filterProject);
    }
  }, [filterProject]);

  const loadCompletedTasks = async (projectFilter) => {
    try {
      const projectId = projectFilter === 'all' ? null : projectFilter;
      const tasksData = await getCompletedTasks(projectId);
      const tasksList = Array.isArray(tasksData.results) 
        ? tasksData.results 
        : (Array.isArray(tasksData) ? tasksData : []);
      
      const tasksWithStats = tasksList.map(task => calculateCompletionStats(task));
      setTasks(tasksWithStats);
      calculateOverallStats(tasksWithStats);
      
    } catch (error) {
      console.error('Error loading completed tasks:', error);
      toast.error('Error al cargar las tareas completadas');
    }
  };

  const calculateCompletionStats = (task) => {
    if (!task.completed_at || !task.due_date) {
      return {
        ...task,
        completionStatus: 'unknown',
        delayDays: 0,
        completedOnTime: false
      };
    }

    const completedDate = parseISO(task.completed_at);
    const dueDate = parseISO(task.due_date);
    const delayDays = differenceInDays(completedDate, dueDate);
    
    const completedOnTime = isBefore(completedDate, dueDate) || delayDays === 0;

    return {
      ...task,
      completionStatus: completedOnTime ? 'on-time' : 'delayed',
      delayDays: completedOnTime ? 0 : Math.max(0, delayDays),
      completedOnTime
    };
  };

  const calculateOverallStats = (tasksList) => {
    const total = tasksList.length;
    const onTime = tasksList.filter(task => task.completedOnTime).length;
    const delayed = tasksList.filter(task => !task.completedOnTime).length;
    
    const delayedTasks = tasksList.filter(task => !task.completedOnTime);
    const totalDelay = delayedTasks.reduce((sum, task) => sum + task.delayDays, 0);
    const averageDelay = delayedTasks.length > 0 ? totalDelay / delayedTasks.length : 0;

    setStats({
      total,
      onTime,
      delayed,
      averageDelay: Math.round(averageDelay * 10) / 10
    });
  };

  const handleProjectFilterChange = (projectId) => {
    setFilterProject(projectId);
    const newSearchParams = new URLSearchParams(searchParams);
    if (projectId === 'all') {
      newSearchParams.delete('project');
    } else {
      newSearchParams.set('project', projectId);
    }
    setSearchParams(newSearchParams);
  };

  const getStatusBadge = (task) => {
    if (task.completionStatus === 'on-time') {
      return (
        <div className="completion-badge on-time">
          <FiCheck size={14} />
          <span>Completada a tiempo</span>
        </div>
      );
    } else if (task.completionStatus === 'delayed') {
      return (
        <div className="completion-badge delayed">
          <FiClock size={14} />
          <span>Con retraso: {task.delayDays} día{task.delayDays !== 1 ? 's' : ''}</span>
        </div>
      );
    } else {
      return (
        <div className="completion-badge unknown">
          <FiAlertTriangle size={14} />
          <span>Sin información de fecha</span>
        </div>
      );
    }
  };

  const formatDateSafe = (dateString, formatStr = 'dd/MM/yyyy') => {
    if (!dateString) return 'Sin fecha';
    try {
      return format(parseISO(dateString), formatStr, { locale: es });
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return 'Fecha inválida';
    }
  };

  const getPriorityText = (priority) => {
    const priorityMap = { 
      'LOW': 'Baja', 
      'MEDIUM': 'Media', 
      'HIGH': 'Alta' 
    };
    return priorityMap[priority] || priority;
  };

  const exportToCSV = () => {
    const headers = [
      'ID Tarea',
      'Título',
      'Proyecto', 
      'Asignado a',
      'Email Asignado',
      'Fecha Límite',
      'Fecha Completación',
      'Estado Cumplimiento',
      'Días de Retraso',
      'Prioridad',
      'Creado por',
      'Fecha Creación'
    ];

    const csvData = tasks.map(task => [
      task.id,
      `"${task.title || 'Sin título'}"`,
      `"${task.project_name || task.project?.name || 'Sin proyecto'}"`,
      `"${task.assigned_to ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}` : 'No asignado'}"`,
      `"${task.assigned_to?.email || 'N/A'}"`,
      task.due_date ? formatDateSafe(task.due_date, 'dd/MM/yyyy') : 'Sin fecha',
      task.completed_at ? formatDateSafe(task.completed_at, 'dd/MM/yyyy HH:mm') : 'Sin fecha',
      task.completedOnTime ? 'A tiempo' : 'Con retraso',
      task.delayDays || 0,
      task.priority ? getPriorityText(task.priority) : 'No definida',
      `"${task.created_by ? `${task.created_by.first_name} ${task.created_by.last_name}` : 'Sistema'}"`,
      task.created_at ? format(parseISO(task.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'
    ]);

    const summary = [
      'RESUMEN',
      `Total Tareas: ${stats.total}`,
      `Completadas a Tiempo: ${stats.onTime} (${stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0}%)`,
      `Completadas con Retraso: ${stats.delayed} (${stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0}%)`,
      `Retraso Promedio: ${stats.averageDelay} días`,
      `Fecha de Reporte: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
    ];

    const csvContent = [
      'REPORTE DE TAREAS COMPLETADAS - MH SOLUCIONES EMPRESARIALES',
      `Período: ${format(new Date(), 'dd/MM/yyyy')}`,
      '',
      headers.join(','),
      ...csvData.map(row => row.join(',')),
      '',
      ...summary
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte-tareas-completadas-${format(new Date(), 'dd-MM-yyyy-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Reporte exportado correctamente');
  };

  if (loading || !user) {
    return <Loading fullscreen />;
  }

  const allowedRoles = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'PROFESSOR', 'CEO', 'RH'];
  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="access-denied">
        <div className="access-denied-content">
          <FiX size={48} className="access-denied-icon" />
          <h2>Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Tareas Finalizadas | MH Soluciones</title>
      </Helmet>

      {selectedTask && (
        <Modal
          title="Detalles de Tarea Completada"
          onClose={() => setSelectedTask(null)}
          size="large"
        >
          <TaskDetailsView
            task={selectedTask}
            user={user}
            onClose={() => setSelectedTask(null)}
            onTaskUpdated={() => {
              loadCompletedTasks(filterProject);
              setSelectedTask(null);
            }}
            onTaskDeleted={() => {
              loadCompletedTasks(filterProject);
              setSelectedTask(null);
            }}
          />
        </Modal>
      )}

      <div className="completed-tasks-page animate-slide-up">
        <div className="page-header">
          <div className="header-content">
            <div className="title-section">
              <FiCheckCircle className="page-icon" />
              <h1>Tareas Finalizadas</h1>
              <p>Revisión y análisis de tareas completadas</p>
            </div>
            <div className="header-actions">
              <button 
                className="btn btn-secondary"
                onClick={exportToCSV}
                disabled={tasks.length === 0}
              >
                <FiDownload />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card total">
            <div className="stat-icon">
              <FiCheckCircle />
            </div>
            <div className="stat-content">
              <h3>{stats.total}</h3>
              <p>Total Completadas</p>
            </div>
          </div>
          
          <div className="stat-card on-time">
            <div className="stat-icon">
              <FiCheck />
            </div>
            <div className="stat-content">
              <h3>{stats.onTime}</h3>
              <p>A Tiempo</p>
              <span className="stat-percentage">
                {stats.total > 0 ? Math.round((stats.onTime / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
          
          <div className="stat-card delayed">
            <div className="stat-icon">
              <FiClock />
            </div>
            <div className="stat-content">
              <h3>{stats.delayed}</h3>
              <p>Con Retraso</p>
              <span className="stat-percentage">
                {stats.total > 0 ? Math.round((stats.delayed / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
          
          <div className="stat-card average-delay">
            <div className="stat-icon">
              <FiAlertTriangle />
            </div>
            <div className="stat-content">
              <h3>{stats.averageDelay}</h3>
              <p>Retraso Promedio</p>
              <span className="stat-unit">días</span>
            </div>
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
                value={filterProject}
                onChange={(e) => handleProjectFilterChange(e.target.value)}
              >
                <option value="all">Todos los Proyectos</option>
                {Array.isArray(projects) && projects.length > 0 ? (
                  projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))
                ) : (
                  <option disabled>No hay proyectos disponibles</option>
                )}
              </select>
            </div>
            
            <div className="results-count">
              {tasks.length} tarea{tasks.length !== 1 ? 's' : ''} encontrada{tasks.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="completed-tasks-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="completed-task-item"
                >
                  <div className="task-main-info">
                    <div className="task-header">
                      <h3 className="task-title">{task.title}</h3>
                      {getStatusBadge(task)}
                    </div>
                    
                    <div className="task-details">
                      <div className="task-meta">
                        <span className="project-badge">{task.project_name || task.project?.name}</span>
                        {task.assigned_to && (
                          <span className="assignee">
                            Asignado a: {task.assigned_to.first_name} {task.assigned_to.last_name}
                          </span>
                        )}
                      </div>
                      
                      <div className="task-dates">
                        {task.due_date && (
                          <div className="date-info">
                            <strong>Fecha Límite:</strong>
                            <span>{format(parseISO(task.due_date), 'dd MMM yyyy', { locale: es })}</span>
                          </div>
                        )}
                        {task.completed_at && (
                          <div className="date-info">
                            <strong>Completada:</strong>
                            <span>{format(parseISO(task.completed_at), 'dd MMM yyyy', { locale: es })}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedTask(task)}
                    >
                      <FiEye />
                      Ver Detalles
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <FiCheckCircle size={48} />
                <h3>No hay tareas completadas</h3>
                <p>No se encontraron tareas completadas con los filtros seleccionados.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CompletedTasksPage;