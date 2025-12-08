import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getMyTasks } from '../../services/taskService';
import { getCurrentUserFromSession } from '../../services/userService';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import { FiCheckSquare, FiClock, FiAward, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { format, parseISO, differenceInHours } from 'date-fns';
import { es } from 'date-fns/locale';
import './TasksPage.scss';

const StudentTasksPage = () => {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({
    to_submit: [],
    submitted: [],
    graded: [],
    overdue: []
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTab, setActiveTab] = useState('to_submit');

  const fetchData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const [userData, tasksData] = await Promise.all([
        getCurrentUserFromSession(),
        getMyTasks(),
      ]);

      setUser(userData);
      setTasks(tasksData);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('No se pudieron cargar las tareas.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const handleTaskUpdated = useCallback((updatedTask) => {
    // Refresh tasks after update
    fetchData(true);
  }, [fetchData]);

  const getTaskStatusIndicator = (task) => {
    const now = new Date();
    const closeDate = task.close_date ? parseISO(task.close_date) : null;
    
    if (!closeDate) return 'status-default';
    
    const hoursUntilClose = differenceInHours(closeDate, now);
    
    if (hoursUntilClose < 0) {
      return 'status-overdue'; // Red
    } else if (hoursUntilClose <= 48) {
      return 'status-soon'; // Yellow
    } else {
      return 'status-open'; // Green
    }
  };

  const renderTaskCard = (task, icon) => {
    const statusClass = getTaskStatusIndicator(task);
    
    return (
      <div
        key={task.id}
        className={`task-card ${statusClass}`}
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
          <div className="task-icon">{icon}</div>
          <h3 className="task-title">{task.title}</h3>
        </div>
        
        <div className="task-card-body">
          <p className="task-description">{task.description || 'Sin descripción'}</p>
          
          <div className="task-meta">
            {task.close_date && (
              <div className="task-deadline">
                <FiClock size={14} />
                <span>Cierre: {format(parseISO(task.close_date), "dd MMM yyyy 'a las' HH:mm", { locale: es })}</span>
              </div>
            )}
            
            {task.max_score && (
              <div className="task-score">
                <FiAward size={14} />
                <span>Puntuación máxima: {task.max_score}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading || !user) {
    return <Loading fullscreen text="Cargando tareas..." />;
  }

  return (
    <>
      <Helmet>
        <title>Mis Tareas | MH Soluciones</title>
      </Helmet>

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
            onTaskUpdated={handleTaskUpdated}
          />
        </Modal>
      )}

      <div className="tasks-page animate-slide-up">
        <div className="page-header">
          <h1>Mis Tareas</h1>
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
          </div>
        </div>

        <div className="glass-card">
          <div className="tabs-container">
            <div className="tabs-header">
              <button
                className={`tab ${activeTab === 'to_submit' ? 'active' : ''}`}
                onClick={() => setActiveTab('to_submit')}
              >
                <FiCheckSquare />
                Por Entregar ({tasks.to_submit.length})
              </button>
              <button
                className={`tab ${activeTab === 'submitted' ? 'active' : ''}`}
                onClick={() => setActiveTab('submitted')}
              >
                <FiCheckSquare />
                Entregadas ({tasks.submitted.length})
              </button>
              <button
                className={`tab ${activeTab === 'graded' ? 'active' : ''}`}
                onClick={() => setActiveTab('graded')}
              >
                <FiAward />
                Calificadas ({tasks.graded.length})
              </button>
              <button
                className={`tab ${activeTab === 'overdue' ? 'active' : ''}`}
                onClick={() => setActiveTab('overdue')}
              >
                <FiAlertCircle />
                Vencidas ({tasks.overdue.length})
              </button>
            </div>

            <div className="tabs-content">
              {activeTab === 'to_submit' && (
                <div className="tasks-grid">
                  {tasks.to_submit.length > 0 ? (
                    tasks.to_submit.map((task) => renderTaskCard(task, <FiCheckSquare />))
                  ) : (
                    <div className="empty-state">
                      <FiCheckSquare size={48} />
                      <p>No tienes tareas por entregar</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'submitted' && (
                <div className="tasks-grid">
                  {tasks.submitted.length > 0 ? (
                    tasks.submitted.map((task) => renderTaskCard(task, <FiCheckSquare />))
                  ) : (
                    <div className="empty-state">
                      <FiCheckSquare size={48} />
                      <p>No tienes tareas entregadas pendientes de calificación</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'graded' && (
                <div className="tasks-grid">
                  {tasks.graded.length > 0 ? (
                    tasks.graded.map((task) => renderTaskCard(task, <FiAward />))
                  ) : (
                    <div className="empty-state">
                      <FiAward size={48} />
                      <p>No tienes tareas calificadas aún</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'overdue' && (
                <div className="tasks-grid">
                  {tasks.overdue.length > 0 ? (
                    tasks.overdue.map((task) => renderTaskCard(task, <FiAlertCircle />))
                  ) : (
                    <div className="empty-state">
                      <FiAlertCircle size={48} />
                      <p>No tienes tareas vencidas</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentTasksPage;
