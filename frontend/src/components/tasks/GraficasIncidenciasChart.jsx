import React, { useState, useEffect, useContext } from 'react';
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
import { FiAlertTriangle } from 'react-icons/fi';
import { ThemeContext } from '../../contexts/ThemeContext';
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

const GraficasIncidenciasChart = ({ projectId, tasks, project }) => {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [chartRows, setChartRows] = useState([]);
  const [hasGraficasTask, setHasGraficasTask] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('ALL');

  useEffect(() => {
    const graficasTask = Array.isArray(tasks) 
      ? tasks.find(t => t.title && t.title.toUpperCase().includes('GRAFICAS'))
      : null;

    const storedStr = localStorage.getItem(`graficas_data_project_${projectId}`);
    
    if (graficasTask || storedStr) {
      setHasGraficasTask(true);
      const data = getGraficasData(graficasTask, project || { id: projectId });
      const rowsToSet = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
      setChartRows(rowsToSet);
    } else {
      setHasGraficasTask(false);
    }
  }, [projectId, tasks, project]);

  useEffect(() => {
    const handleDataUpdated = (e) => {
      const { projectId: evtPid, rows } = e.detail || {};
      if (String(evtPid) === String(projectId) && rows) {
        setHasGraficasTask(true);
        const rowsToSet = Array.isArray(rows) ? rows : (Array.isArray(rows?.table2) ? rows.table2 : []);
        setChartRows(rowsToSet);
      }
    };

    const handleStorage = (e) => {
      if (e.key === `graficas_data_project_${projectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setHasGraficasTask(true);
            const rowsToSet = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.table2) ? parsed.table2 : []);
            setChartRows(rowsToSet);
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

  if (!hasGraficasTask || !Array.isArray(chartRows) || chartRows.length === 0) {
    return null;
  }

  const projectName = project?.name || 'MB VILLA JUAREZ DET. 2594';

  const availableWeeks = chartRows.map(r => r.semana || '').filter(Boolean);
  const activeRows = selectedWeek === 'ALL' ? chartRows : (() => {
    const idx = chartRows.findIndex(r => r.semana === selectedWeek);
    return idx !== -1 ? chartRows.slice(0, idx + 1) : chartRows;
  })();
  const rowsToUse = activeRows.length > 0 ? activeRows : chartRows;

  const labels = rowsToUse.map(r => r.semana || '');

  const kpiData = rowsToUse.map(r => {
    const calc = calculateRowValues(r);
    return calc.incidencias_kpi || 0;
  });

  const campoData = rowsToUse.map(r => {
    const calc = calculateRowValues(r);
    return calc.incidencias_campo || 0;
  });

  const totalData = rowsToUse.map(r => {
    const calc = calculateRowValues(r);
    return calc.incidencias_total || 0;
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'INCIDENCIAS REGISTRADAS EN KPI (20%)',
        data: kpiData,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.1,
      },
      {
        label: 'INCIDENCIAS SOLVENTADAS EN CAMPO (80%)',
        data: campoData,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.1,
      },
      {
        label: 'TOTAL',
        data: totalData,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.1,
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
          color: isDarkMode ? '#e2e8f0' : '#1e293b',
          font: {
            family: 'Inter, system-ui, sans-serif',
            size: 12,
            weight: '600'
          },
          padding: 20,
          usePointStyle: true,
        }
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: isDarkMode ? '#ffffff' : '#0f172a',
        bodyColor: isDarkMode ? '#e2e8f0' : '#334155',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          drawBorder: false,
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#475569',
          font: {
            weight: '500'
          }
        }
      },
      y: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          drawBorder: false,
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#475569',
          font: {
            weight: '500'
          },
          stepSize: 5
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };

  const selectedRow = chartRows.find(r => r.semana === selectedWeek);

  return (
    <div className="glass-card graficas-activity-chart-wrapper" style={{ marginBottom: '24px' }}>
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="chart-title">
            <FiAlertTriangle className="title-icon" style={{ color: '#f59e0b' }} />
            {projectName}
          </h3>
          <span className="chart-subtitle">Registro de Incidencias en KPI vs Campo por Semana</span>
        </div>
        
        <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="week-select-inc" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
          <select
            id="week-select-inc"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">Todas las semanas ({chartRows.length})</option>
            {availableWeeks.map((w, idx) => (
              <option key={idx} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedWeek !== 'ALL' && rowsToUse.length > 0 && (() => {
        const accumActos = rowsToUse.reduce((sum, r) => sum + (parseFloat(r.actos) || 0), 0);
        const accumCond = rowsToUse.reduce((sum, r) => sum + (parseFloat(r.condiciones) || 0), 0);
        const accumKpi = rowsToUse.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_kpi || 0), 0);
        const accumCampo = rowsToUse.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_campo || 0), 0);
        const accumTotal = rowsToUse.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_total || 0), 0);

        return (
          <div className="week-status-kpi-panel" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            margin: '0 0 20px 0',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Actos Inseguros (Acum.)</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#fbbf24' : '#d97706', marginTop: '4px' }}>{accumActos}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Cond. Inseguras (Acum.)</span>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#facc15' : '#ca8a04', marginTop: '4px' }}>{accumCond}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Incidencias KPI (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#3b82f6' : '#2563eb', marginTop: '2px' }}>{accumKpi}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Solventadas en Campo (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#ef4444' : '#dc2626', marginTop: '2px' }}>{accumCampo}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Total Incidencias (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#f59e0b' : '#d97706', marginTop: '2px' }}>{accumTotal}</div>
            </div>
          </div>
        );
      })()}

      <div className="chart-container-box">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default GraficasIncidenciasChart;
