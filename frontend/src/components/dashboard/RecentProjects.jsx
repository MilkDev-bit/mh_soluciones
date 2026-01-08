import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiFolder, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import './Dashboard.scss';

const RecentProjects = ({ projects }) => {
  const [showAll, setShowAll] = useState(false);

  if (!projects || projects.length === 0) {
    return (
      <div className="dashboard-widget">
        <h2>Proyectos Recientes</h2>
        <p>No hay proyectos para mostrar.</p>
      </div>
    );
  }

  const displayedProjects = showAll ? projects : projects.slice(0, 4);
  const hasMore = projects.length > 4;
  const hiddenCount = projects.length - 4;

  return (
    <div className="dashboard-widget">
      <h2>Proyectos Recientes</h2>
      <div className="widget-list-container">
        <ul className="widget-list">
          {displayedProjects.map(project => (
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
      {hasMore && (
        <button
          className="widget-toggle-button"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <FiChevronUp /> Mostrar menos
            </>
          ) : (
            <>
              <FiChevronDown /> Ver todos (+{hiddenCount} más)
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default RecentProjects;