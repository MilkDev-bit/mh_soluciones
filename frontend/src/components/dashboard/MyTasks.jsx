import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheckSquare } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateTime, WINDOW_STATE, TONE_COLORS } from '../../utils/taskStatus';
import './Dashboard.scss';

const MyTasks = ({ tasks }) => {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="dashboard-widget">
        <h2>Mis Tareas Pendientes</h2>
        <p>¡Felicidades! No tienes tareas pendientes.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-widget">
      <h2>Mis Tareas Pendientes</h2>
      <ul className="widget-list">
        {tasks.map(task => {
          
          const projectId = 
            task?.project?.id || 
            task?.project_id || 
            task?.projectId || 
            (typeof task?.project !== 'object' ? task?.project : null);
          
          // El servidor ya calcula la fecha límite real y el estado del alumno
          // (window_state / window_message). Antes se mostraba due_date tal cual.
          const meta = WINDOW_STATE[task.window_state];
          const colors = meta ? TONE_COLORS[meta.tone] : null;
          const dateText = task.is_continuous
            ? 'Actividad continua · sin vencimiento'
            : task.deadline
              ? `Vence: ${formatDateTime(task.deadline, "dd MMMM yyyy, HH:mm")}`
              : task.due_date
                ? `Vence: ${format(parseISO(task.due_date), 'dd MMMM, yyyy', { locale: es })}`
                : 'Sin fecha de vencimiento';

          const taskContent = (
            <div className="widget-list-item">
              <FiCheckSquare className="item-icon" />
              <div className="item-info">
                <span className="item-title">{task.title}</span>
                <span className="item-details">{dateText}</span>
                {meta && task.window_state !== 'OPEN' && task.window_state !== 'NO_DEADLINE' && (
                  <span className="item-details" title={task.window_message}
                        style={{ color: colors.text, fontWeight: 600 }}>
                    {meta.label}{task.window_message ? ` — ${task.window_message}` : ''}
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <li key={task.id}>
              {projectId ? (
                <Link to={`/projects/${projectId}`}>
                  {taskContent}
                </Link>
              ) : (
                <div 
                  title="Esta tarea no tiene un proyecto asignado" 
                  style={{ opacity: 0.7, cursor: 'not-allowed' }}
                >
                  {taskContent}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default MyTasks;