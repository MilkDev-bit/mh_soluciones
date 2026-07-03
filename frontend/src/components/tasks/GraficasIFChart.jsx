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
import { FiActivity } from 'react-icons/fi';
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

const calcIF = (accidentes, hh) => {
  if (!hh || hh <= 0 || isNaN(hh)) return 0;
  const val = (accidentes * 1000) / hh;
  return isNaN(val) || !isFinite(val) ? 0 : Number(val.toFixed(2));
};

const GraficasIFChart = ({ projectId, tasks, project }) => {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [table1Rows, setTable1Rows] = useState([]);
  const [table2Rows, setTable2Rows] = useState([]);
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
      const t1 = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
      const t2 = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
      setTable1Rows(t1);
      setTable2Rows(t2);
    } else {
      setHasGraficasTask(false);
    }
  }, [projectId, tasks, project]);

  useEffect(() => {
    const handleDataUpdated = (e) => {
      const { projectId: evtPid, rows } = e.detail || {};
      if (String(evtPid) === String(projectId) && rows) {
        setHasGraficasTask(true);
        const t1 = Array.isArray(rows) ? rows : (Array.isArray(rows?.table1) ? rows.table1 : []);
        const t2 = Array.isArray(rows) ? rows : (Array.isArray(rows?.table2) ? rows.table2 : []);
        setTable1Rows(t1);
        setTable2Rows(t2);
      }
    };

    const handleStorage = (e) => {
      if (e.key === `graficas_data_project_${projectId}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            setHasGraficasTask(true);
            const t1 = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.table1) ? parsed.table1 : []);
            const t2 = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.table2) ? parsed.table2 : []);
            setTable1Rows(t1);
            setTable2Rows(t2);
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

  if (!hasGraficasTask || !Array.isArray(table2Rows) || table2Rows.length === 0) {
    return null;
  }

  const projectName = project?.name || 'MB VILLA JUAREZ DET. 2594';

  const availableWeeks = table2Rows.map(r => r.semana || '').filter(Boolean);
  const activeRows2 = selectedWeek === 'ALL' ? table2Rows : (() => {
    const idx = table2Rows.findIndex(r => r.semana === selectedWeek);
    return idx !== -1 ? table2Rows.slice(0, idx + 1) : table2Rows;
  })();
  const rowsToUse2 = activeRows2.length > 0 ? activeRows2 : table2Rows;

  const labels = rowsToUse2.map(r => r.semana || '');

  // Función auxiliar para obtener las Horas Hombre (total_hh) de una semana específica
  const getHHForIndex = (semana, idx) => {
    let t1Row = table1Rows.find(r => r.semana === semana);
    if (!t1Row && table1Rows[idx]) t1Row = table1Rows[idx];
    if (!t1Row) return 0;
    const calc = calculateRowValues(t1Row);
    return calc.total_hh || 0;
  };

  const ifAccData = rowsToUse2.map((r, idx) => {
    const calc2 = calculateRowValues(r);
    const hh = getHHForIndex(r.semana, idx);
    return calcIF(calc2.accidentes_incapacitantes || 0, hh);
  });

  const data = {
    labels,
    datasets: [
      {
        label: 'IF - ACCIDENTES INCAPACITANTES',
        data: ifAccData,
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
          }
        },
        beginAtZero: true
      }
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  };

  return (
    <div className="glass-card graficas-activity-chart-wrapper" style={{ marginBottom: '24px' }}>
      <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="chart-title">
            <FiActivity className="title-icon" style={{ color: '#10b981' }} />
            Índice de Frecuencia (IF) - {projectName}
          </h3>
          <span className="chart-subtitle">
            Fórmula: (Número de Accidentes Incapacitantes × 1,000,000) ÷ Horas-hombre trabajadas
          </span>
        </div>
        
        <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="week-select-if" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
          <select
            id="week-select-if"
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
            <option value="ALL">Todas las semanas ({table2Rows.length})</option>
            {availableWeeks.map((w, idx) => (
              <option key={idx} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedWeek !== 'ALL' && rowsToUse2.length > 0 && (() => {
        const accumAcc = rowsToUse2.reduce((sum, r) => sum + (calculateRowValues(r).accidentes_incapacitantes || 0), 0);
        const accumHH = rowsToUse2.reduce((sum, r, idx) => sum + getHHForIndex(r.semana, idx), 0);
        const ifAccAcum = calcIF(accumAcc, accumHH);

        return (
          <div className="week-status-kpi-panel" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            margin: '0 0 20px 0',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Total Horas-hombre (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669', marginTop: '4px' }}>{accumHH.toLocaleString()}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Accidentes Incapacitantes (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#fbbf24' : '#d97706', marginTop: '4px' }}>{accumAcc}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>IF Acumulado</span>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: isDarkMode ? '#ef4444' : '#dc2626', marginTop: '2px' }}>{ifAccAcum}</div>
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

export default GraficasIFChart;
