import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { FiTrendingUp, FiAlertTriangle, FiBarChart2, FiLayers, FiActivity } from 'react-icons/fi';
import api from '../../services/api';
import { getGraficasData, calculateRowValues } from '../tasks/GraficasActivityTable';
import { ThemeContext } from '../../contexts/ThemeContext';
import '../tasks/GraficasActivityChart.scss';
import '../tasks/GraficasActivityTable.scss';

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
  const val = (accidentes * 1000000) / hh;
  return isNaN(val) || !isFinite(val) ? 0 : Number(val.toFixed(2));
};

const GeneralGraficasReports = ({ projects }) => {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  const [selectedWeek1, setSelectedWeek1] = useState('ALL');
  const [selectedWeek2, setSelectedWeek2] = useState('ALL');
  const [selectedWeek3, setSelectedWeek3] = useState('ALL');
  const [refreshIndex, setRefreshIndex] = useState(0);

  const { data: allTasksData } = useQuery({
    queryKey: ['allTasksForGeneralReports', refreshIndex],
    queryFn: async () => {
      try {
        const res = await api.get('/tasks/?page_size=1000');
        return res.data?.results || res.data || [];
      } catch (err) {
        console.error('Error fetching tasks for general reports:', err);
        return [];
      }
    },
    staleTime: 2000,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });

  const allTasks = useMemo(() => {
    return Array.isArray(allTasksData) ? allTasksData : [];
  }, [allTasksData]);

  // Listen for storage or custom events when data is updated
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshIndex(prev => prev + 1);
    };

    window.addEventListener('graficasDataUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('graficasDataUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const { table1Rows, table2Rows } = useMemo(() => {
    if (!Array.isArray(projects) || projects.length === 0) {
      return { table1Rows: [], table2Rows: [] };
    }

    const allProjectsData = projects.map(p => {
      const task = Array.isArray(allTasks)
        ? allTasks.find(t => (String(t.project) === String(p.id) || String(t.project?.id) === String(p.id)) && t.title && t.title.toUpperCase().includes('GRAFICAS'))
        : null;
      return getGraficasData(task, p);
    });

    const weekSet = new Set();
    allProjectsData.forEach(data => {
      const t1 = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
      const t2 = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
      t1.forEach(r => { if (r?.semana) weekSet.add(r.semana.trim()); });
      t2.forEach(r => { if (r?.semana) weekSet.add(r.semana.trim()); });
    });

    const sortedWeeks = Array.from(weekSet).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    if (sortedWeeks.length === 0) {
      for (let i = 1; i <= 6; i++) sortedWeeks.push(`SEMANA ${i}`);
    }

    const t1Rows = sortedWeeks.map((w, idx) => {
      let sumActos = 0;
      let sumCondiciones = 0;
      let sumFt = 0;
      let sumTotalHH = 0;

      allProjectsData.forEach(data => {
        const t1 = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
        const row = t1.find(r => (r?.semana || '').trim().toUpperCase() === w.toUpperCase());
        if (row) {
          sumActos += parseFloat(row.actos) || 0;
          sumCondiciones += parseFloat(row.condiciones) || 0;
          const ftVal = parseFloat(row.ft) || 0;
          sumFt += ftVal;
          sumTotalHH += ftVal * 50;
        }
      });

      const baseRow = {
        id: `gen-t1-${idx}`,
        semana: w,
        actos: sumActos,
        condiciones: sumCondiciones,
        ft: sumFt,
        total_hh: sumTotalHH,
        meta: 2.0,
        bajo: 1.0,
        alto: 3.5
      };

      return calculateRowValues(baseRow, 1000);
    });

    const t2Rows = sortedWeeks.map((w, idx) => {
      let sumActos = 0;
      let sumCondiciones = 0;
      let sumCampo = 0;
      let sumAcc = 0;
      let hasCampoCustom = false;

      allProjectsData.forEach(data => {
        const t2 = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
        const row = t2.find(r => (r?.semana || '').trim().toUpperCase() === w.toUpperCase());
        if (row) {
          sumActos += parseFloat(row.actos) || 0;
          sumCondiciones += parseFloat(row.condiciones) || 0;
          sumAcc += parseFloat(row.accidentes_incapacitantes) || 0;
          if (row.incidencias_campo !== undefined && row.incidencias_campo !== '') {
            sumCampo += parseFloat(row.incidencias_campo) || 0;
            hasCampoCustom = true;
          }
        }
      });

      const baseRow = {
        id: `gen-t2-${idx}`,
        semana: w,
        actos: sumActos,
        condiciones: sumCondiciones,
        incidencias_campo: hasCampoCustom ? sumCampo : '',
        accidentes_incapacitantes: sumAcc
      };

      return calculateRowValues(baseRow);
    });

    return { table1Rows: t1Rows, table2Rows: t2Rows };
  }, [projects, allTasks, refreshIndex]);

  const availableWeeks1 = table1Rows.map(r => r.semana || '').filter(Boolean);
  const activeRows1 = selectedWeek1 === 'ALL' ? table1Rows : (() => {
    const idx = table1Rows.findIndex(r => r.semana === selectedWeek1);
    return idx !== -1 ? table1Rows.slice(0, idx + 1) : table1Rows;
  })();
  const rowsToUse1 = activeRows1.length > 0 ? activeRows1 : table1Rows;

  const labels1 = rowsToUse1.map(r => r.semana || '');
  const resultadoData1 = rowsToUse1.map(r => {
    const val = r._resultadoNum !== undefined ? r._resultadoNum : parseFloat(r.resultado);
    return isNaN(val) ? 0 : val;
  });
  const metaData1 = rowsToUse1.map(r => parseFloat(r.meta) || 2.0);
  const bajoData1 = rowsToUse1.map(r => parseFloat(r.bajo) || 1.0);
  const altoData1 = rowsToUse1.map(r => parseFloat(r.alto) || 3.5);

  const data1 = {
    labels: labels1,
    datasets: [
      {
        label: 'RESULTADO GENERAL (FRECUENCIA)',
        data: resultadoData1,
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
        label: 'META (2.0)',
        data: metaData1,
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'BAJO (1.0)',
        data: bajoData1,
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'ALTO (3.5)',
        data: altoData1,
        borderColor: '#ef4444',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };

  const availableWeeks2 = table2Rows.map(r => r.semana || '').filter(Boolean);
  const activeRows2 = selectedWeek2 === 'ALL' ? table2Rows : (() => {
    const idx = table2Rows.findIndex(r => r.semana === selectedWeek2);
    return idx !== -1 ? table2Rows.slice(0, idx + 1) : table2Rows;
  })();
  const rowsToUse2 = activeRows2.length > 0 ? activeRows2 : table2Rows;

  const labels2 = rowsToUse2.map(r => r.semana || '');
  const kpiData2 = rowsToUse2.map(r => r.incidencias_kpi || 0);
  const campoData2 = rowsToUse2.map(r => r.incidencias_campo || 0);
  const totalData2 = rowsToUse2.map(r => r.incidencias_total || 0);

  const data2 = {
    labels: labels2,
    datasets: [
      {
        label: 'INCIDENCIAS REGISTRADAS EN KPI (20%)',
        data: kpiData2,
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
        data: campoData2,
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
        data: totalData2,
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

  const availableWeeks3 = table2Rows.map(r => r.semana || '').filter(Boolean);
  const activeRows3 = selectedWeek3 === 'ALL' ? table2Rows : (() => {
    const idx = table2Rows.findIndex(r => r.semana === selectedWeek3);
    return idx !== -1 ? table2Rows.slice(0, idx + 1) : table2Rows;
  })();
  const rowsToUse3 = activeRows3.length > 0 ? activeRows3 : table2Rows;

  const labels3 = rowsToUse3.map(r => r.semana || '');

  const getHHForIndexGen = (semana, idx) => {
    let t1Row = table1Rows.find(r => r.semana === semana);
    if (!t1Row && table1Rows[idx]) t1Row = table1Rows[idx];
    if (!t1Row) return 0;
    return parseFloat(t1Row.total_hh) || 0;
  };

  const ifAccData3 = rowsToUse3.map((r, idx) => {
    const hh = getHHForIndexGen(r.semana, idx);
    return calcIF(r.accidentes_incapacitantes || 0, hh);
  });

  const data3 = {
    labels: labels3,
    datasets: [
      {
        label: 'IF - ACCIDENTES INCAPACITANTES',
        data: ifAccData3,
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
          font: { weight: '500' }
        }
      },
      y: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          drawBorder: false,
        },
        ticks: {
          color: isDarkMode ? '#94a3b8' : '#475569',
          font: { weight: '500' },
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

  const selectedRow1 = table1Rows.find(r => r.semana === selectedWeek1);
  const selectedRow2 = table2Rows.find(r => r.semana === selectedWeek2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Tabla 1 General Consolidada: Rendimiento */}
      <div className="glass-card graficas-activity-table-wrapper" style={{ padding: '0', overflow: 'hidden', border: 'none' }}>
        <div className="table-header-banner" style={{ backgroundColor: '#10b981', margin: 0, padding: '14px 20px', fontSize: '15px', fontWeight: 'bold', color: '#ffffff' }}>
          CONSOLIDADO GENERAL DE PROYECTOS - RENDIMIENTO Y DESEMPEÑO (TABLA 1)
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="col-semana">SEMANA</th>
                <th className="col-actos">ACTOS INSEGUROS (20%)</th>
                <th className="col-condiciones">CONDICIONES INSEGURAS (20%)</th>
                <th className="col-ft">FT (SUMA)</th>
                <th className="col-total">TOTAL DE HORAS HOMBRE</th>
                <th className="col-corregidas">HH CORREGIDAS</th>
                <th className="col-resultado">RESULTADO</th>
                <th className="col-meta">META</th>
                <th className="col-bajo">BAJO</th>
                <th className="col-alto">ALTO</th>
              </tr>
            </thead>
            <tbody>
              {table1Rows.map((row, idx) => {
                const calc = calculateRowValues(row);
                return (
                  <tr key={row.id || idx}>
                    <td className="cell-readonly" style={{ fontWeight: 'bold' }}>{row.semana}</td>
                    <td className="cell-readonly">{row.actos || 0}</td>
                    <td className="cell-readonly">{row.condiciones || 0}</td>
                    <td className="cell-readonly">{row.ft || 0}</td>
                    <td className="cell-readonly" style={{ fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669' }}>{calc.total_hh}</td>
                    <td className="cell-readonly">{calc.hh_corregidas}</td>
                    <td className={`cell-readonly ${calc.resultado === '#DIV/0!' ? 'cell-error' : ''}`} style={{ fontWeight: 'bold' }}>
                      {calc.resultado}
                    </td>
                    <td className="cell-readonly">{row.meta || 2.0}</td>
                    <td className="cell-readonly">{row.bajo || 1.0}</td>
                    <td className="cell-readonly">{row.alto || 3.5}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabla 2 General Consolidada: Incidencias y Accidentes */}
      <div className="glass-card graficas-activity-table-wrapper" style={{ padding: '0', overflow: 'hidden', border: 'none' }}>
        <div className="table-header-banner" style={{ backgroundColor: '#3b82f6', margin: 0, padding: '14px 20px', fontSize: '15px', fontWeight: 'bold', color: '#ffffff' }}>
          CONSOLIDADO GENERAL DE PROYECTOS - REGISTRO DE INCIDENCIAS Y ACCIDENTES (TABLA 2)
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th className="col-semana">SEMANA</th>
                <th className="col-actos">ACTOS INSEGUROS</th>
                <th className="col-condiciones">CONDICIONES INSEGURAS</th>
                <th className="col-kpi">INCIDENCIAS REGISTRADAS EN KPI (20%)</th>
                <th className="col-campo">INCIDENCIAS SOLVENTADAS EN CAMPO (80%)</th>
                <th className="col-total-inc">TOTAL INCIDENCIAS</th>
                <th className="col-acc-inc" style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>ACCIDENTES INCAPACITANTES</th>
              </tr>
            </thead>
            <tbody>
              {table2Rows.map((row, idx) => {
                const calc = calculateRowValues(row);
                return (
                  <tr key={row.id || idx}>
                    <td className="cell-readonly" style={{ fontWeight: 'bold' }}>{row.semana}</td>
                    <td className="cell-readonly">{row.actos || 0}</td>
                    <td className="cell-readonly">{row.condiciones || 0}</td>
                    <td className="cell-readonly" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#c2410c' }}>{calc.incidencias_kpi}</td>
                    <td className="cell-readonly">{row.incidencias_campo !== undefined && row.incidencias_campo !== '' ? row.incidencias_campo : calc.incidencias_campo}</td>
                    <td className="cell-readonly" style={{ backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#b45309', fontWeight: 'bold' }}>{calc.incidencias_total}</td>
                    <td className="cell-readonly" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', fontWeight: 'bold', fontSize: '15px' }}>{row.accidentes_incapacitantes || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico 1: Rendimiento y Desempeño General (Horas Hombre y FT) */}
      <div className="glass-card graficas-activity-chart-wrapper">
        <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="chart-title">
              <FiBarChart2 className="title-icon" style={{ color: '#3b82f6' }} />
              Rendimiento y Desempeño de Seguridad (General)
            </h3>
            <span className="chart-subtitle">Consolidado General de {projects?.length || 0} Proyectos por Semana (Horas Hombre y FT)</span>
          </div>
          
          <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="week-select-gen1" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
            <select
              id="week-select-gen1"
              value={selectedWeek1}
              onChange={(e) => setSelectedWeek1(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">Todas las semanas ({table1Rows.length})</option>
              {availableWeeks1.map((w, idx) => (
                <option key={idx} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedWeek1 !== 'ALL' && rowsToUse1.length > 0 && (() => {
          const accumActos = rowsToUse1.reduce((sum, r) => sum + (parseFloat(r.actos) || 0), 0);
          const accumCond = rowsToUse1.reduce((sum, r) => sum + (parseFloat(r.condiciones) || 0), 0);
          const accumFt = rowsToUse1.reduce((sum, r) => sum + (parseFloat(r.ft) || 0), 0);
          const accumTotalHH = rowsToUse1.reduce((sum, r) => sum + ((parseFloat(r.ft) || 0) * 50), 0);
          const accumHHCorregidas = accumTotalHH / 1000;
          const accumResultadoVal = accumHHCorregidas === 0 ? 0 : (accumActos + accumCond) / accumHHCorregidas;
          const accumResultado = Number.isInteger(accumResultadoVal) ? accumResultadoVal.toString() : accumResultadoVal.toFixed(9).replace(/\.?0+$/, '');

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
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>FT Total (Acum.)</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#60a5fa' : '#2563eb', marginTop: '4px' }}>{accumFt}</div>
              </div>
              <div className="kpi-item">
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Total Horas Hombre (Acum.)</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669', marginTop: '4px' }}>{accumTotalHH}</div>
              </div>
              <div className="kpi-item">
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>HH Corregidas (Acum.)</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: isDarkMode ? '#a855f7' : '#7c3aed', marginTop: '4px' }}>{accumHHCorregidas}</div>
              </div>
              <div className="kpi-item">
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Resultado General (Acum.)</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#3b82f6' : '#2563eb', marginTop: '2px' }}>{accumResultado}</div>
              </div>
            </div>
          );
        })()}

        <div className="chart-container-box">
          <Line data={data1} options={options} />
        </div>
      </div>

      {/* Gráfico 2: Registro de Incidencias en KPI vs Campo (General) */}
      <div className="glass-card graficas-activity-chart-wrapper">
        <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="chart-title">
              <FiAlertTriangle className="title-icon" style={{ color: '#f59e0b' }} />
              Registro de Incidencias en KPI vs Campo (General)
            </h3>
            <span className="chart-subtitle">Consolidado General de {projects?.length || 0} Proyectos por Semana</span>
          </div>
          
          <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="week-select-gen2" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
            <select
              id="week-select-gen2"
              value={selectedWeek2}
              onChange={(e) => setSelectedWeek2(e.target.value)}
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
              {availableWeeks2.map((w, idx) => (
                <option key={idx} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedWeek2 !== 'ALL' && rowsToUse2.length > 0 && (() => {
          const accumActos = rowsToUse2.reduce((sum, r) => sum + (parseFloat(r.actos) || 0), 0);
          const accumCond = rowsToUse2.reduce((sum, r) => sum + (parseFloat(r.condiciones) || 0), 0);
          const accumKpi = rowsToUse2.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_kpi || 0), 0);
          const accumCampo = rowsToUse2.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_campo || 0), 0);
          const accumTotal = rowsToUse2.reduce((sum, r) => sum + (calculateRowValues(r).incidencias_total || 0), 0);

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
          <Line data={data2} options={options} />
        </div>
      </div>

      {/* Gráfico 3: Índice de Frecuencia (IF) General */}
      <div className="glass-card graficas-activity-chart-wrapper">
        <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="chart-title">
              <FiActivity className="title-icon" style={{ color: '#10b981' }} />
              Índice de Frecuencia de Accidentes Incapacitantes (General)
            </h3>
            <span className="chart-subtitle">
              Fórmula: (Número de Accidentes Incapacitantes × 1,000,000) ÷ Horas-hombre trabajadas
            </span>
          </div>
          
          <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="week-select-gen3" style={{ fontSize: '13px', fontWeight: '500' }}>Filtrar Semana:</label>
            <select
              id="week-select-gen3"
              value={selectedWeek3}
              onChange={(e) => setSelectedWeek3(e.target.value)}
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
              {availableWeeks3.map((w, idx) => (
                <option key={idx} value={w}>{w}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedWeek3 !== 'ALL' && rowsToUse3.length > 0 && (() => {
          const accumAcc = rowsToUse3.reduce((sum, r) => sum + (calculateRowValues(r).accidentes_incapacitantes || 0), 0);
          const accumHH = rowsToUse3.reduce((sum, r, idx) => sum + getHHForIndexGen(r.semana, idx), 0);
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
          <Line data={data3} options={options} />
        </div>
      </div>
    </div>
  );
};

export default GeneralGraficasReports;
