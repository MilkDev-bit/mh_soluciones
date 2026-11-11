import React, { useState, useEffect } from 'react';
import { getMyTasks } from '../../services/taskService';
import { FiAward, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import './GradesWidget.scss';

const GradesWidget = ({ isCollapsed }) => {
  const [grades, setGrades] = useState([]);
  const [averageScore, setAverageScore] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGrades();
  }, []);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      const data = await getMyTasks();
      
      // Extract graded tasks
      const gradedTasks = data.graded || [];
      
      // Get the latest submissions with grades
      const gradesData = [];
      let totalScore = 0;
      let totalMaxScore = 0;

      gradedTasks.forEach(task => {
        // [FIX] La lista de tareas no trae `submissions`; la calificación
        // del alumno viene en `my_score` (última entrega). Se deja
        // `submissions` como respaldo por compatibilidad.
        let score = task.my_score;
        if ((score === null || score === undefined) && Array.isArray(task.submissions) && task.submissions.length > 0) {
          const latestSubmission = task.submissions.reduce((latest, current) =>
            (current.version > latest.version ? current : latest));
          score = latestSubmission.score;
        }
        if (score === null || score === undefined) return;

        const maxScore = Number(task.max_score) || 100;
        gradesData.push({
          taskTitle: task.title,
          score: Number(score),
          maxScore,
          percentage: ((Number(score) / maxScore) * 100).toFixed(1),
        });
        totalScore += Number(score);
        totalMaxScore += maxScore;
      });

      // Con todo el ancho caben más: se muestran las 6 más recientes.
      setGrades(gradesData.slice(0, 6));
      
      if (totalMaxScore > 0) {
        setAverageScore(((totalScore / totalMaxScore) * 100).toFixed(1));
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isCollapsed) {
    return (
      <div className="grades-widget-collapsed">
        <FiAward size={20} />
        {!loading && averageScore > 0 && (
          <span className="average-badge">{averageScore}%</span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grades-widget">
        <div className="widget-header">
          <FiAward />
          <span>Mis Calificaciones</span>
        </div>
        <div className="widget-loading">Cargando...</div>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="grades-widget">
        <div className="widget-header">
          <FiAward />
          <span>Mis Calificaciones</span>
        </div>
        <div className="widget-empty">
          <p>No hay calificaciones aún</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grades-widget">
      <div className="widget-header">
        <FiAward />
        <span>Mis Calificaciones</span>
      </div>

      <div className="grades-body">
      <div className="average-score">
        <div className="score-circle">
          <FiTrendingUp />
          <span className="score-value">{averageScore}%</span>
        </div>
        <p className="score-label">Promedio General</p>
      </div>

      <div className="recent-grades">
        <h4>Calificaciones Recientes</h4>
        <div className="grade-list">
        {grades.map((grade, index) => (
          <div key={index} className="grade-item">
            <div className="grade-info">
              <span className="task-name">{grade.taskTitle}</span>
              <span className="grade-score">
                {grade.score}/{grade.maxScore}
              </span>
            </div>
            <div className="grade-bar">
              <div 
                className="grade-fill" 
                style={{ 
                  width: `${grade.percentage}%`,
                  backgroundColor: grade.percentage >= 70 ? '#10b981' : grade.percentage >= 50 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            <span className="grade-percentage">{grade.percentage}%</span>
          </div>
        ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default GradesWidget;
