import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheckSquare } from 'react-icons/fi';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
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
          
          const hasDate = Boolean(task.due_date);

          const taskContent = (
            <div className="widget-list-item">
              <FiCheckSquare className="item-icon" />
              <div className="item-info">
                <span className="item-title">{task.title}</span>
                <span className="item-details">
                  {hasDate 
                    ? `Vence: ${format(parseISO(task.due_date), 'dd MMMM, yyyy', { locale: es })}`
                    : 'Sin fecha de vencimiento'}
                </span>
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