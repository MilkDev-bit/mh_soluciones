import { memo } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiCheckSquare, FiCalendar, FiTrendingUp } from 'react-icons/fi';
import { translateStatus } from '../../utils/projectUtils';
import './Projects.scss';

const ProjectCard = memo(({ project }) => {
  const progress = project.progress || 0;
  
  const memberCount = project.member_count || project.members_count || project.members?.length || 0;
  const tasksCount = project.tasks_count || project.tasks?.length || 0;
  
  const description = project.description?.substring(0, 100) || 'Este proyecto no tiene una descripción.';
  const displayDescription = description.length > 100 ? `${description}...` : description;

  // Format dates if available
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const startDate = formatDate(project.start_date);
  const endDate = formatDate(project.end_date);

  // Determine status color
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'IN_PROGRESS':
        return 'status-in-progress';
      case 'COMPLETED':
        return 'status-completed';
      case 'PLANNING':
        return 'status-planning';
      case 'ON_HOLD':
        return 'status-on-hold';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return 'status-default';
    }
  };

  return (
    <Link to={`/projects/${project.id}`} className="project-card-link">
      <div className="project-card glass-card">
        <div className="card-header">
          <div className="project-title-wrapper">
            <h3 className="project-title">{project.name}</h3>
            <span className={`status-badge ${getStatusColor(project.status)}`}>
              {translateStatus(project.status)}
            </span>
          </div>
        </div>
        
        <p className="project-description">
          {displayDescription}
        </p>
        
        {(startDate || endDate) && (
          <div className="project-dates">
            <FiCalendar className="date-icon" />
            <span className="date-text">
              {startDate && endDate ? (
                `${startDate} - ${endDate}`
              ) : startDate ? (
                `Inicio: ${startDate}`
              ) : (
                `Fin: ${endDate}`
              )}
            </span>
          </div>
        )}
        
        <div className="project-footer">
          <div className="project-stats">
            <div className="stat-item" title={`${memberCount} miembros`}>
              <FiUsers />
              <span>{memberCount}</span>
            </div>
            <div className="stat-item" title={`${tasksCount} tareas`}>
              <FiCheckSquare />
              <span>{tasksCount}</span>
            </div>
            <div className="stat-item" title={`${progress}% completado`}>
              <FiTrendingUp />
              <span>{progress}%</span>
            </div>
          </div>
          
          <div className="project-progress">
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  backgroundColor: progress === 100 ? '#198754' : progress > 70 ? '#ffc107' : '#2C74B3'
                }}
                aria-label={`Progreso: ${progress}%`}
              />
            </div>
            <span className="progress-value">{progress}%</span>
          </div>
        </div>
      </div>
    </Link>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if project data actually changed
  return prevProps.project.id === nextProps.project.id &&
         prevProps.project.updated_at === nextProps.project.updated_at &&
         prevProps.project.progress === nextProps.project.progress &&
         prevProps.project.status === nextProps.project.status;
});

ProjectCard.displayName = 'ProjectCard';

export default ProjectCard;