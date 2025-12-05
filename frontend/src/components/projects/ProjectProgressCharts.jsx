import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import { getProjectProgressStats } from '../../services/projectService';
import { FiPieChart, FiBarChart2 } from 'react-icons/fi';
import './ProjectProgressCharts.scss';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const ProjectProgressCharts = ({ projectId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!projectId) return;
      
      try {
        setLoading(true);
        const data = await getProjectProgressStats(projectId);
        setStats(data);
      } catch (err) {
        console.error('Error fetching progress stats:', err);
        setError('No se pudieron cargar las estadísticas');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [projectId]);

  if (loading) {
    return (
      <div className="charts-loading">
        <div className="loading-spinner"></div>
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="charts-error">
        <p>{error || 'No hay estadísticas disponibles'}</p>
      </div>
    );
  }

  const { task_stats, priority_stats, total_tasks, total_submissions, progress_percentage } = stats;

  // If there are no tasks, show a message
  if (total_tasks === 0) {
    return (
      <div className="charts-empty">
        <FiPieChart size={48} />
        <p>No hay tareas en este proyecto para mostrar estadísticas.</p>
      </div>
    );
  }

  // Task Status Pie Chart Data
  const taskStatusData = {
    labels: ['Pendiente', 'En Progreso', 'En Revisión', 'Completada'],
    datasets: [
      {
        data: [
          task_stats.pending,
          task_stats.in_progress,
          task_stats.for_review,
          task_stats.completed,
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',    // Red - Pending
          'rgba(249, 115, 22, 0.8)',   // Orange - In Progress
          'rgba(59, 130, 246, 0.8)',   // Blue - For Review
          'rgba(16, 185, 129, 0.8)',   // Green - Completed
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(249, 115, 22, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Task Priority Bar Chart Data
  const taskPriorityData = {
    labels: ['Baja', 'Media', 'Alta'],
    datasets: [
      {
        label: 'Tareas por Prioridad',
        data: [
          priority_stats.low,
          priority_stats.medium,
          priority_stats.high,
        ],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',   // Green - Low
          'rgba(245, 158, 11, 0.8)',   // Yellow - Medium
          'rgba(239, 68, 68, 0.8)',    // Red - High
        ],
        borderColor: [
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
        borderRadius: 8,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${context.label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.raw} tareas`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: {
            family: "'Inter', sans-serif",
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
          },
        },
      },
    },
  };

  return (
    <div className="project-progress-charts">
      <div className="charts-header">
        <h3>
          <FiPieChart /> Progreso del Proyecto
        </h3>
        <div className="progress-summary">
          <div className="progress-circle">
            <span className="progress-value">{progress_percentage}%</span>
          </div>
          <div className="progress-stats">
            <p><strong>{task_stats.completed}</strong> de <strong>{total_tasks}</strong> tareas completadas</p>
            <p><strong>{total_submissions}</strong> entregas realizadas</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h4>
            <FiPieChart /> Estado de Tareas
          </h4>
          <div className="chart-wrapper">
            <Pie data={taskStatusData} options={pieOptions} />
          </div>
        </div>

        <div className="chart-container">
          <h4>
            <FiBarChart2 /> Tareas por Prioridad
          </h4>
          <div className="chart-wrapper">
            <Bar data={taskPriorityData} options={barOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressCharts;
