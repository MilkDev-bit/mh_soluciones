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
        label: 'Tasa IF (por 1,000 HH)',
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
      {
        label: 'META IF (Tasa 0.02)',
        data: rowsToUse2.map(() => 0.02),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'BAJO IF (Tasa 0.01)',
        data: rowsToUse2.map(() => 0.01),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'ALTO IF (Tasa 0.05)',
        data: rowsToUse2.map(() => 0.05),
        borderColor: '#ef4444',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
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
            if (context.dataset.label && (context.dataset.label.includes('META') || context.dataset.label.includes('BAJO') || context.dataset.label.includes('ALTO'))) {
              const label = context.dataset.label;
              let desc = '';
              if (label.includes('META')) desc = 'Tasa meta u objetivo aceptable de control';
              if (label.includes('BAJO')) desc = 'Tasa óptima que refleja excelencia en seguridad';
              if (label.includes('ALTO')) desc = 'Tasa crítica de alerta que requiere atención';
              return [
                `${label}`,
                `Valor Umbral: ${context.parsed.y} por cada 1,000 HH`,
                `Significado: ${desc} (NO es conteo de accidentes)`
              ];
            }
            const idx = context.dataIndex;
            const row = rowsToUse2[idx] || {};
            const acc = calculateRowValues(row).accidentes_incapacitantes || 0;
            const hh = getHHForIndex(row.semana, idx);
            return [
              `Tasa IF: ${context.parsed.y} (por 1,000 HH)`,
              `Accidentes Reales: ${acc} ${acc === 1 ? 'accidente' : 'accidentes'}`,
              `Horas-Hombre: ${hh.toLocaleString()} HH`
            ];
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
            Tasa de Frecuencia de Accidentes (IF) - {projectName}
          </h3>
          <span className="chart-subtitle" style={{ display: 'block', marginTop: '4px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>
            <strong>Nota:</strong> Muestra el <em>Índice de Frecuencia (Tasa por cada 1,000 HH)</em>, NO la cantidad de accidentes reales. Fórmula: (No. de Accidentes × 1,000) ÷ HH.
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
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Accidentes Reales (Acum.)</span>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#fbbf24' : '#d97706', marginTop: '4px' }}>{accumAcc}</div>
            </div>
            <div className="kpi-item">
              <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Tasa IF Acumulada (por 1,000 HH)</span>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: isDarkMode ? '#ef4444' : '#dc2626', marginTop: '2px' }}>{ifAccAcum}</div>
            </div>
          </div>
        );
      })()}

      <div className="reference-lines-explanation" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px',
        margin: '0 0 16px 0',
        padding: '12px 16px',
        backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.5)' : 'rgba(241, 245, 249, 0.7)',
        borderRadius: '10px',
        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#f59e0b', marginTop: '2px', flexShrink: 0 }}></span>
          <div>
            <strong style={{ color: isDarkMode ? '#fde68a' : '#b45309' }}>BAJO IF (Tasa 0.01):</strong>
            <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Nivel de excelencia en seguridad. Refleja un índice óptimo con mínima accidentabilidad por cada 1,000 horas.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981', marginTop: '2px', flexShrink: 0 }}></span>
          <div>
            <strong style={{ color: isDarkMode ? '#a7f3d0' : '#047857' }}>META IF (Tasa 0.02):</strong>
            <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Promedio industrial objetivo por 1,000 horas trabajadas. Representa un índice de accidentabilidad controlado.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', marginTop: '2px', flexShrink: 0 }}></span>
          <div>
            <strong style={{ color: isDarkMode ? '#fecaca' : '#b91c1c' }}>ALTO IF (Tasa 0.05):</strong>
            <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Límite crítico superior de alerta roja. Superar esta tasa exige investigación e intervención prioritaria.</div>
          </div>
        </div>
      </div>

      <div className="chart-container-box">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

export default GraficasIFChart;
