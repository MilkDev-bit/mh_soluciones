import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { getMyTasks } from '../../services/taskService';
import { getCurrentUserFromSession } from '../../services/userService';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import TaskDetailsView from '../../components/tasks/TaskDetailsView';
import {
  FiCheckSquare, FiClock, FiAward, FiAlertCircle, FiRefreshCw, FiRotateCcw, FiAlertTriangle, FiInbox,
} from 'react-icons/fi';
import { taskDeadlineLabel, WINDOW_STATE, TONE_COLORS } from '../../utils/taskStatus';
import './TasksPage.scss';

// Pestañas = grupos que calcula el backend en /tasks/my-tasks/
const TABS = [
  { key: 'to_submit', label: 'Por entregar', icon: FiCheckSquare, empty: 'No tienes tareas por entregar' },
  { key: 'changes_requested', label: 'Correcciones', icon: FiRotateCcw, empty: 'No tienes entregas devueltas' },
  { key: 'late', label: 'Entrega tardía', icon: FiAlertTriangle, empty: 'No tienes tareas en periodo de entrega tardía' },
  { key: 'submitted', label: 'En revisión', icon: FiInbox, empty: 'No tienes entregas esperando revisión' },
  { key: 'graded', label: 'Aprobadas', icon: FiAward, empty: 'Aún no tienes entregas aprobadas' },
  { key: 'overdue', label: 'Vencidas', icon: FiAlertCircle, empty: 'No tienes tareas vencidas' },
];

const TONE_TO_CLASS = { danger: 'status-overdue', warning: 'status-soon', info: 'status-open', success: 'status-open' };

const StudentTasksPage = () => {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState({
    to_submit: [], changes_requested: [], late: [], submitted: [], graded: [], overdue: [],
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
      setTasks(prev => ({ ...prev, ...tasksData }));
      
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

  // El color sale del estado que calcula el servidor (antes se comparaba
  // close_date con la hora del navegador e ignoraba due_date y prórrogas).
  const getTaskStatusIndicator = (task) => {
    const tone = WINDOW_STATE[task.my_window?.state]?.tone;
    return TONE_TO_CLASS[tone] || 'status-default';
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
            {taskDeadlineLabel(task) && (
              <div className="task-deadline">
                <FiClock size={14} />
                <span>Vence: {taskDeadlineLabel(task)}</span>
              </div>
            )}

            {task.my_window?.message && (() => {
              const colors = TONE_COLORS[WINDOW_STATE[task.my_window.state]?.tone || 'info'];
              return (
                <p className="task-window-message" style={{ color: colors.text, fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                  {task.my_window.message}
                </p>
              );
            })()}
            
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
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  className={`tab ${activeTab === key ? 'active' : ''}`}
                  onClick={() => setActiveTab(key)}
                >
                  <Icon />
                  {label} ({tasks[key]?.length || 0})
                </button>
              ))}
            </div>

            <div className="tabs-content">
              {TABS.filter(t => t.key === activeTab).map(({ key, icon: Icon, empty }) => (
                <div className="tasks-grid" key={key}>
                  {tasks[key]?.length > 0 ? (
                    tasks[key].map((task) => renderTaskCard(task, <Icon />))
                  ) : (
                    <div className="empty-state">
                      <Icon size={48} />
                      <p>{empty}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentTasksPage;
