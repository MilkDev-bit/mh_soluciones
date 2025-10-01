import React from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiCheckSquare } from 'react-icons/fi';
import { translateStatus } from '../../utils/projectUtils';
import './Projects.scss';

const ProjectCard = ({ project }) => {
  const progress = project.progress || 0;
  
  const memberCount = project.member_count || project.members_count || project.members?.length || 0;
  const tasksCount = project.tasks_count || project.tasks?.length || 0;
  
  const description = project.description?.substring(0, 100) || 'Este proyecto no tiene una descripción.';
  const displayDescription = description.length > 100 ? `${description}...` : description;

  return (
    <Link to={`/projects/${project.id}`} className="project-card-link">
      <div className="project-card glass-card">
        <div className="card-header">
          <h3 className="project-title">{project.name}</h3>
          <span className={`status-badge status-${project.status?.toLowerCase() || 'pending'}`}>
            {translateStatus(project.status)}
          </span>
        </div>
        <p className="project-description">
          {displayDescription}
        </p>
        <div className="project-footer">
          <div className="project-stats">
            <div className="stat-item">
              <FiUsers />
              <span>{memberCount}</span>
            </div>
            <div className="stat-item">
              <FiCheckSquare />
              <span>{tasksCount}</span>
            </div>
          </div>
          <div className="project-progress">
            <div className="progress-bar">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              ></div>
            </div>
            <span className="progress-value">{progress}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProjectCard;