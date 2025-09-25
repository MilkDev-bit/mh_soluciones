import React from 'react';
import { Link } from 'react-router-dom';
import { FiCheckSquare } from 'react-icons/fi';
import { format } from 'date-fns';
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
        {tasks.map(task => (
          <li key={task.id}>
            <Link to={`/projects/${task.project}`}>
              <div className="widget-list-item">
                <FiCheckSquare className="item-icon" />
                <div className="item-info">
                  <span className="item-title">{task.title}</span>
                  <span className="item-details">
                    Vence: {format(new Date(task.due_date), 'dd MMMM, yyyy', { locale: es })}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyTasks;