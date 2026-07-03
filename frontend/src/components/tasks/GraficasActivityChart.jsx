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
import { getGraficasData, calculateRowValues, upgradeRowThresholds } from './GraficasActivityTable';
import { FiTrendingUp } from 'react-icons/fi';
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

const GraficasActivityChart = ({ projectId, tasks, project }) => {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [chartRows, setChartRows] = useState([]);
  const [hasGraficasTask, setHasGraficasTask] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('ALL');

  useEffect(() => {
    // Check if there is a GRAFICAS task or local storage data for this project
    const graficasTask = Array.isArray(tasks) 
      ? tasks.find(t => t.title && t.title.toUpperCase().includes('GRAFICAS'))
      : null;

    const storedStr = localStorage.getItem(`graficas_data_project_${projectId}`);
    
    if (graficasTask || storedStr) {
      setHasGraficasTask(true);
      const data = getGraficasData(graficasTask, project || { id: projectId });
      const rowsToSet = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
      setChartRows(upgradeRowThresholds(rowsToSet));
    } else {
      setHasGraficasTask(false);
      setChartRows([]);
    }
  }, [projectId, tasks, project]);

  // Listen for real-time updates when editing the table inside the modal
  useEffect(() => {
    const handleDataUpdated = (e) => {
      const { projectId: evtPid, rows } = e.detail || {};
      if (String(evtPid) === String(projectId) && rows) {
        setHasGraficasTask(true);
        const rowsToSet = Array.isArray(rows) ? rows : (Array.isArray(rows?.table1) ? rows.table1 : []);
        setChartRows(upgradeRowThresholds(rowsToSet));
      }
    };

    const handleStorage = (e) => {
      if (e.key === `graficas_data_project_${projectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setHasGraficasTask(true);
            const rowsToSet = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.table1) ? parsed.table1 : []);
            setChartRows(upgradeRowThresholds(rowsToSet));
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

  const resultadoData = rowsToUse.map(r => {
    const calc = calculateRowValues(r);
    return calc._resultadoNum || 0;
  });

  const metaData = rowsToUse.map(r => {
    const val = parseFloat(r.meta);
    return (val === 0.8 || isNaN(val)) ? 2.0 : val;
  });
  const bajoData = rowsToUse.map(r => {
    const val = parseFloat(r.bajo);
    return (val === 0.7 || isNaN(val)) ? 1.0 : val;
  });
  const altoData = rowsToUse.map(r => {
    const val = parseFloat(r.alto);
    return (val === 1.4 || isNaN(val)) ? 3.5 : val;
  });

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
          color: isDarkMode ? '#e2e8f0' : '#1e293b',
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
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: isDarkMode ? '#ffffff' : '#0f172a',
        bodyColor: isDarkMode ? '#e2e8f0' : '#334155',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.15)',
        borderWidth: 1,
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
          color: isDarkMode ? '#94a3b8' : '#475569',
          stepSize: 0.5,
          font: {
            family: "'Inter', sans-serif",
            size: 11
          },
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      },
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#475569',
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

  const selectedRow = chartRows.find(r => r.semana === selectedWeek);

  return (
    <div className="glass-card graficas-activity-chart-wrapper" style={{ marginBottom: '24px' }}>
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="chart-title">
            <FiTrendingUp className="title-icon" />
            {projectName}
          </h3>
          <span className="chart-subtitle">Rendimiento de Seguridad por Semana</span>
        </div>
        
        <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="week-select" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
          <select
            id="week-select"
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
        const accumTotalHH = rowsToUse.reduce((sum, r) => sum + ((parseFloat(r.ft) || 0) * 50), 0);
        const accumHHCorregidas = accumTotalHH / 1000;
        const resVal = accumHHCorregidas === 0 ? 0 : (accumActos + accumCond) / accumHHCorregidas;
        const lastRow = rowsToUse[rowsToUse.length - 1] || {};
        const lastAltoVal = parseFloat(lastRow.alto);
        const lastAlto = (lastAltoVal === 1.4 || isNaN(lastAltoVal)) ? 3.5 : lastAltoVal;
        const lastMetaVal = parseFloat(lastRow.meta);
        const lastMeta = (lastMetaVal === 0.8 || isNaN(lastMetaVal)) ? 2.0 : lastMetaVal;

        let statusColor = '#10b981'; // Green
        let statusText = 'Óptimo (Debajo de Meta)';
        if (resVal > lastAlto) {
          statusColor = '#ef4444'; // Red
          statusText = 'Crítico (Supera Alto)';
        } else if (resVal > lastMeta) {
          statusColor = '#f59e0b'; // Amber
          statusText = 'Alerta (Supera Meta)';
        }

        return (
          <div className="week-status-kpi-panel" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px',
            margin: '0 0 20px 0',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Estado</span>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: statusColor, marginTop: '4px' }}>{statusText}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Resultado (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#3b82f6' : '#2563eb', marginTop: '2px' }}>{resVal.toFixed(4)}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Actos Inseguros (Acum.)</span>
              <div className="kpi-val-default" style={{ fontSize: '16px', fontWeight: '600', marginTop: '2px' }}>{accumActos}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Cond. Inseguras (Acum.)</span>
              <div className="kpi-val-default" style={{ fontSize: '16px', fontWeight: '600', marginTop: '2px' }}>{accumCond}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Total HH (Acum.)</span>
              <div className="kpi-val-default" style={{ fontSize: '16px', fontWeight: '600', marginTop: '2px' }}>{accumTotalHH}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>HH Corregidas (Acum.)</span>
              <div className="kpi-val-default" style={{ fontSize: '16px', fontWeight: '600', marginTop: '2px' }}>{accumHHCorregidas.toFixed(2)}</div>
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

export default GraficasActivityChart;
