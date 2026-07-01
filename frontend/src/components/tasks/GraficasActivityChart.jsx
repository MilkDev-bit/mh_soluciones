import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getGraficasData, calculateRowValues } from './GraficasActivityTable';
import { FiTrendingUp } from 'react-icons/fi';
import './GraficasActivityChart.scss';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const GraficasActivityChart = ({ projectId, tasks, project }) => {
  const [chartRows, setChartRows] = useState([]);
  const [hasGraficasTask, setHasGraficasTask] = useState(false);

  useEffect(() => {
    // Check if there is a GRAFICAS task or local storage data for this project
    const graficasTask = Array.isArray(tasks) 
      ? tasks.find(t => t.title && t.title.toUpperCase().includes('GRAFICAS'))
      : null;

    const storedStr = localStorage.getItem(`graficas_data_project_${projectId}`);
    
    if (graficasTask || storedStr) {
      setHasGraficasTask(true);
      const data = getGraficasData(graficasTask, project || { id: projectId });
      setChartRows(data);
    } else {
      setHasGraficasTask(false);
    }
  }, [projectId, tasks, project]);

  // Listen for real-time updates when editing the table inside the modal
  useEffect(() => {
    const handleDataUpdated = (e) => {
      const { projectId: evtPid, rows } = e.detail || {};
      if (String(evtPid) === String(projectId) && Array.isArray(rows)) {
        setHasGraficasTask(true);
        setChartRows(rows);
      }
    };

    const handleStorage = (e) => {
      if (e.key === `graficas_data_project_${projectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setHasGraficasTask(true);
            setChartRows(parsed);
          }
        } catch (err) {}
      }
    };

    window.addEventListener('graficasDataUpdated', handleDataUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('graficasDataUpdated', handleDataUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [projectId]);

  if (!hasGraficasTask || !chartRows || chartRows.length === 0) {
    return null;
  }

  const projectName = project?.name || 'MB VILLA JUAREZ DET. 2594';

  const labels = chartRows.map(r => r.semana || '');

  const resultadoData = chartRows.map(r => {
    const calc = calculateRowValues(r);
    return calc._resultadoNum || 0;
  });

  const metaData = chartRows.map(r => parseFloat(r.meta) || 0.8);
  const bajoData = chartRows.map(r => parseFloat(r.bajo) || 0.7);
  const altoData = chartRows.map(r => parseFloat(r.alto) || 1.4);

  const data = {
    labels,
    datasets: [
      {
        label: 'RESULTADO',
        data: resultadoData,
        borderColor: '#3b82f6', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.1,
        borderWidth: 2.5,
      },
      {
        label: 'META',
        data: metaData,
        borderColor: '#ef4444', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        pointBackgroundColor: '#ef4444',
        pointRadius: 3,
        tension: 0,
        borderWidth: 2,
      },
      {
        label: 'BAJO',
        data: bajoData,
        borderColor: '#f59e0b', // Amber/Yellow
        backgroundColor: 'rgba(245, 158, 11, 0.5)',
        pointBackgroundColor: '#f59e0b',
        pointRadius: 3,
        tension: 0,
        borderWidth: 2,
      },
      {
        label: 'ALTO',
        data: altoData,
        borderColor: '#10b981', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        pointBackgroundColor: '#10b981',
        pointRadius: 3,
        tension: 0,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          padding: 18,
          usePointStyle: true,
          font: {
            size: 12,
            family: "'Inter', system-ui, -apple-system, sans-serif",
            weight: '600'
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        padding: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: {
          family: "'Inter', sans-serif",
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          family: "'Inter', sans-serif",
          size: 12
        },
        callbacks: {
          label: function(context) {
            const val = context.raw;
            const formatted = typeof val === 'number' ? val.toFixed(4).replace(/\.?0+$/, '') : val;
            return `${context.dataset.label}: ${formatted}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: 2.0,
        ticks: {
          stepSize: 0.5,
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.08)',
        },
      },
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11,
            weight: '500'
          },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <div className="glass-card graficas-activity-chart-wrapper" style={{ marginBottom: '24px' }}>
      <div className="chart-header">
        <h3 className="chart-title">
          <FiTrendingUp className="title-icon" />
          {projectName}
        </h3>
        <span className="chart-subtitle">Rendimiento de Seguridad por Semana</span>
      </div>
      
      <div className="chart-container-box">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default GraficasActivityChart;
