import React, { useEffect, useState } from 'react';
import { getStudentPerformance } from '../../services/projectService';
import { FiUser, FiCheckCircle, FiClock, FiTrendingUp } from 'react-icons/fi';
import './StudentPerformance.scss';

const StudentPerformance = ({ projectId }) => {
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
    return (
      <div className="student-performance-empty">
        <FiUser size={48} />
        <p>No hay estudiantes asignados a este proyecto.</p>
      </div>
    );
  }

  // Get performance level label and color
  const getPerformanceLevel = (percentage) => {
    if (percentage >= 90) return { label: 'Excelente', color: '#10b981' };
    if (percentage >= 75) return { label: 'Bueno', color: '#3b82f6' };
    if (percentage >= 60) return { label: 'Regular', color: '#f59e0b' };
    return { label: 'Necesita Mejorar', color: '#ef4444' };
  };

  return (
    <div className="student-performance">
      <div className="performance-header">
        <h3>
          <FiTrendingUp /> Desempeño de Estudiantes
        </h3>
        <p className="performance-subtitle">
          Basado en entregas de tareas a tiempo ({total_students} {total_students === 1 ? 'estudiante' : 'estudiantes'})
        </p>
      </div>

      <div className="performance-list">
        {students.map((student) => {
          const { label, color } = getPerformanceLevel(student.on_time_percentage);
          
          return (
            <div key={student.id} className="student-card">
              <div className="student-info">
                <div className="student-avatar">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=171717&color=fff`}
                    alt={student.name}
                  />
                </div>
                <div className="student-details">
                  <h4 className="student-name">{student.name}</h4>
                  <p className="student-email">{student.email}</p>
                </div>
              </div>

              <div className="student-stats">
                <div className="stat-item">
                  <FiCheckCircle className="stat-icon" style={{ color: '#10b981' }} />
                  <div>
                    <p className="stat-value">{student.on_time_submissions}</p>
                    <p className="stat-label">A tiempo</p>
                  </div>
                </div>
                
                <div className="stat-item">
                  <FiClock className="stat-icon" style={{ color: '#ef4444' }} />
                  <div>
                    <p className="stat-value">{student.late_submissions}</p>
                    <p className="stat-label">Tardías</p>
                  </div>
                </div>

                <div className="stat-item">
                  <div className="performance-circle" style={{ borderColor: color }}>
                    <span className="percentage-value" style={{ color }}>
                      {student.on_time_percentage}%
                    </span>
                  </div>
                  <p className="stat-label" style={{ color }}>
                    {label}
                  </p>
                </div>
              </div>

              <div className="progress-bar-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${student.on_time_percentage}%`,
                      backgroundColor: color
                    }}
                  />
                </div>
                <p className="progress-text">
                  {student.total_submissions} {student.total_submissions === 1 ? 'entrega' : 'entregas'} en total
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
