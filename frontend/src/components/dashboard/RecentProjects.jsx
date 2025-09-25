import React from 'react';
import { Link } from 'react-router-dom';
import { FiFolder } from 'react-icons/fi';
import './Dashboard.scss';

const RecentProjects = ({ projects }) => {
  if (!projects || projects.length === 0) {
    return (
      <div className="dashboard-widget">
        <h2>Proyectos Recientes</h2>
        <p>No hay proyectos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-widget">
      <h2>Proyectos Recientes</h2>
      <ul className="widget-list">
        {projects.map(project => (
          <li key={project.id}>
            <Link to={`/projects/${project.id}`}>
              <div className="widget-list-item">
                <FiFolder className="item-icon" />
                <div className="item-info">
                  <span className="item-title">{project.name}</span>
                  <span className="item-details">{project.status_display}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentProjects;