import React, { useEffect, useState } from 'react';
import { getStudentPerformance } from '../../services/projectService';
import { FiUser, FiCheckCircle, FiClock, FiTrendingUp, FiAward } from 'react-icons/fi';
import './StudentPerformance.scss';

const StudentPerformance = ({ projectId, columnMode = 'full' }) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const data = await getStudentPerformance(projectId);
        setPerformanceData(data);
      } catch (err) {
        console.error('Error fetching student performance:', err);
        setError('No se pudo cargar el desempeño de los estudiantes');
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [projectId]);

  if (loading) {
    return (
      <div className="student-performance-loading">
        <div className="loading-spinner"></div>
        <p>Cargando desempeño de estudiantes...</p>
      </div>
    );
  }

  if (error || !performanceData) {
    return (
      <div className="student-performance-error">
        <p>{error || 'No hay datos de desempeño disponibles'}</p>
      </div>
    );
  }

  const { students, total_students } = performanceData;

  if (!students || students.length === 0) {
    // Only show empty state in 'full' or 'left' mode
    if (columnMode === 'full' || columnMode === 'left') {
      return (
        <div className="student-performance-empty">
          <FiUser size={48} />
          <p>No hay estudiantes asignados a este proyecto.</p>
        </div>
      );
    }
    return null;
  }

  // Get performance level label and color
  const getPerformanceLevel = (percentage) => {
    if (percentage >= 90) return { label: 'Excelente', color: '#10b981' };
    if (percentage >= 75) return { label: 'Bueno', color: '#3b82f6' };
    if (percentage >= 60) return { label: 'Regular', color: '#f59e0b' };
    return { label: 'Necesita Mejorar', color: '#ef4444' };
  };

  // Dividir estudiantes entre columnas
  const getStudentsForColumn = () => {
    if (columnMode === 'full') return students;
    
    const halfPoint = Math.ceil(students.length / 2);
    if (columnMode === 'left') {
      return students.slice(0, halfPoint);
    } else if (columnMode === 'right') {
      return students.slice(halfPoint);
    }
    return students;
  };

  const displayedStudents = getStudentsForColumn();

  // Only show empty state if no students to display
  if (displayedStudents.length === 0) {
    return null;
  }

  // Solo mostrar el header en modo 'full' o 'left'
  const showHeader = columnMode === 'full' || columnMode === 'left';

  return (
    <div className="student-performance">
      {showHeader && (
        <div className="performance-header">
          <h3>
            <FiTrendingUp /> Desempeño de Estudiantes
          </h3>
          <p className="performance-subtitle">
            Basado en entregas de tareas a tiempo ({total_students} {total_students === 1 ? 'estudiante' : 'estudiantes'})
          </p>
        </div>
      )}

      <div className="performance-list">
        {displayedStudents.map((student) => {
          const { label, color } = getPerformanceLevel(student.on_time_percentage);
          const percentage = student.on_time_percentage;
          const circumference = 2 * Math.PI * 36; // radius = 36
          const offset = circumference - (percentage / 100) * circumference;
          
          return (
            <div key={student.id} className="student-card">
              <div className="student-header">
                <div className="student-avatar-container">
                  <svg className="progress-ring" width="90" height="90">
                    <circle
                      className="progress-ring-circle-bg"
                      stroke="rgba(255, 255, 255, 0.1)"
                      strokeWidth="4"
                      fill="transparent"
                      r="36"
                      cx="45"
                      cy="45"
                    />
                    <circle
                      className="progress-ring-circle"
                      stroke={color}
                      strokeWidth="4"
                      fill="transparent"
                      r="36"
                      cx="45"
                      cy="45"
                      style={{
                        strokeDasharray: circumference,
                        strokeDashoffset: offset,
                        transform: 'rotate(-90deg)',
                        transformOrigin: '50% 50%',
                        transition: 'stroke-dashoffset 1s ease-in-out'
                      }}
                    />
                  </svg>
                  <div className="student-avatar">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=171717&color=fff`}
                      alt={student.name}
                    />
                  </div>
                </div>
                <div className="student-info">
                  <div className="student-details">
                    <h4 className="student-name">{student.name}</h4>
                    <p className="student-email">{student.email}</p>
                  </div>
                  <div className="performance-badge" style={{ backgroundColor: color }}>
                    <FiAward />
                    <span>{label}</span>
                  </div>
                </div>
              </div>

              <div className="student-stats">
                <div className="stat-card">
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <FiCheckCircle style={{ color: '#10b981' }} />
                  </div>
                  <div className="stat-content">
                    <p className="stat-value">{student.on_time_submissions}</p>
                    <p className="stat-label">A tiempo</p>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                    <FiClock style={{ color: '#ef4444' }} />
                  </div>
                  <div className="stat-content">
                    <p className="stat-value">{student.late_submissions}</p>
                    <p className="stat-label">Tardías</p>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon-wrapper" style={{ backgroundColor: `${color}20` }}>
                    <FiTrendingUp style={{ color }} />
                  </div>
                  <div className="stat-content">
                    <p className="stat-value" style={{ color }}>{percentage}%</p>
                    <p className="stat-label">Efectividad</p>
                  </div>
                </div>
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar-header">
                  <span className="progress-label">Progreso general</span>
                  <span className="progress-percentage" style={{ color }}>{percentage}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${percentage}%`,
                      background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`
                    }}
                  />
                </div>
                <p className="progress-text">
                  {student.total_submissions} {student.total_submissions === 1 ? 'entrega total' : 'entregas totales'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentPerformance;
