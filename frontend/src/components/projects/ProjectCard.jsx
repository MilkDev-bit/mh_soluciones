import React from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiCheckSquare } from 'react-icons/fi';
import { translateStatus } from '../../utils/projectUtils';
import './Projects.scss';

const ProjectCard = ({ project }) => {
  const progress = project.progress || 0; 

  return (
    <Link to={`/projects/${project.id}`} className="project-card-link">
      <div className="project-card glass-card">
        <div className="card-header">
          <h3 className="project-title">{project.name}</h3>
          <span className={`status-badge status-${project.status.toLowerCase()}`}>
            {translateStatus(project.status)}
          </span>
        </div>
        <p className="project-description">
          {project.description?.substring(0, 100) || 'Este proyecto no tiene una descripción.'}...
        </p>
        <div className="project-footer">
          <div className="project-stats">
            <div className="stat-item">
              <FiUsers />
              <span>{project.member_count}</span>
            </div>
            <div className="stat-item">
              <FiCheckSquare />
              <span>{project.tasks_count || 0}</span>
            </div>
          </div>
          <div className="project-progress">
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="progress-value">{progress}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;