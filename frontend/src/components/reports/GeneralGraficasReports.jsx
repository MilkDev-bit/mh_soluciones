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
import { FiTrendingUp, FiAlertTriangle, FiBarChart2, FiLayers, FiActivity, FiClock } from 'react-icons/fi';
import api from '../../services/api';
import { isoWeek, isoWeekKey, isoWeekLabel, isoWeekRangeLabel, isoWeeksInYear, parseIsoWeekString, parseLocalDate } from '../../utils/isoWeek';
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

/**
 * Semana ISO 8601 de una fila de GRAFICAS.
 *
 * [CAMBIO] Antes había dos vistas y la de "Ciclo de Vida" sumaba la
 * "SEMANA 1" de todos los proyectos aunque fueran de fechas distintas. Los
 * reportes ahora se agrupan siempre por semana ISO 8601 (lunes a domingo).
 * Las filas guardan la semana relativa al inicio del proyecto ("SEMANA 3"),
 * así que se convierte a fecha real: inicio del proyecto + (n-1) semanas.
 * Si la fila ya trae la semana ISO ("2026-W46") se usa tal cual.
 */
const getRowGroupingKey = (project, rowStr) => {
  const direct = parseIsoWeekString(rowStr);
  let iso = direct;
  if (!iso) {
    const numMatch = (rowStr || '').match(/\d+/);
    const weekNum = numMatch ? parseInt(numMatch[0], 10) : 1;
    const baseDate = parseLocalDate(project?.start_date)
      || parseLocalDate(project?.created_at)
      || new Date(new Date().getFullYear(), 0, 1);
    const target = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + (weekNum - 1) * 7);
    iso = isoWeek(target);
  }
  return {
    key: `ISO_${iso.year}_${iso.week}`,
    label: isoWeekLabel(iso),
    range: isoWeekRangeLabel(iso.year, iso.week),
    sortNum: isoWeekKey(iso),
    calYear: iso.year,
    calWeekNo: iso.week,
  };
};

const GeneralGraficasReports = ({ projects }) => {
  const themeContext = useContext(ThemeContext);
  const isDarkMode = themeContext ? themeContext.isDarkMode : true;
  // [CAMBIO] El filtro de cada gráfica es por año ISO (antes era por semana).
  // Por defecto el año ISO en curso: semana 1 hasta la semana actual.
  const currentIsoYear = isoWeek(new Date()).year;
  const [selectedYear1, setSelectedYear1] = useState(String(currentIsoYear));
  const [selectedYear2, setSelectedYear2] = useState(String(currentIsoYear));
  const [selectedYear3, setSelectedYear3] = useState(String(currentIsoYear));
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

  const { table1Rows, table2Rows, availableYears } = useMemo(() => {
    const nowIso = isoWeek(new Date());
    if (!Array.isArray(projects) || projects.length === 0) {
      return { table1Rows: [], table2Rows: [], availableYears: [nowIso.year] };
    }

    const allProjectsData = projects.map(p => {
      const task = Array.isArray(allTasks)
        ? allTasks.find(t => (String(t.project) === String(p.id) || String(t.project?.id) === String(p.id)) && t.title && t.title.toUpperCase().includes('GRAFICAS'))
        : null;
      return { project: p, data: getGraficasData(task, p) };
    });

    const groupMap = new Map();
    allProjectsData.forEach(({ project, data }) => {
      const t1 = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
      const t2 = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
      t1.forEach(r => {
        if (r?.semana) {
          const info = getRowGroupingKey(project, r.semana);
          if (!groupMap.has(info.key)) groupMap.set(info.key, info);
        }
      });
      t2.forEach(r => {
        if (r?.semana) {
          const info = getRowGroupingKey(project, r.semana);
          if (!groupMap.has(info.key)) groupMap.set(info.key, info);
        }
      });
    });

    // [CAMBIO] Filtro por año: para cada año ISO con datos (y el año en curso)
    // se generan TODAS sus semanas, de la 1 a la 52/53, o hasta la semana
    // actual si es el año en curso. Las semanas sin captura quedan en cero, así
    // el eje X es continuo. Nunca se muestran semanas futuras: las tablas de
    // GRAFICAS traen filas en ceros de semanas que aún no ocurren.
    const currentWeekKey = isoWeekKey(nowIso);
    const years = new Set([nowIso.year]);
    groupMap.forEach(g => {
      if (g.sortNum <= currentWeekKey) years.add(g.calYear);
    });
    const yearList = Array.from(years).sort((a, b) => a - b);
    const sortedGroups = [];
    yearList.forEach(year => {
      const lastWeek = year === nowIso.year ? nowIso.week : isoWeeksInYear(year);
      for (let week = 1; week <= lastWeek; week++) {
        sortedGroups.push({
          key: `ISO_${year}_${week}`,
          label: isoWeekLabel({ year, week }),
          range: isoWeekRangeLabel(year, week),
          sortNum: isoWeekKey({ year, week }),
          calYear: year,
          calWeekNo: week,
        });
      }
    });

    const t1Rows = sortedGroups.map((g, idx) => {
      let sumActos = 0;
      let sumCondiciones = 0;
      let sumFt = 0;
      let sumTotalHH = 0;

      allProjectsData.forEach(({ project, data }) => {
        const t1 = Array.isArray(data) ? data : (Array.isArray(data?.table1) ? data.table1 : []);
        const row = t1.find(r => r?.semana && getRowGroupingKey(project, r.semana).key === g.key);
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
        semana: g.label,
        _year: g.calYear,
        _week: g.calWeekNo,
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

    const t2Rows = sortedGroups.map((g, idx) => {
      let sumActos = 0;
      let sumCondiciones = 0;
      let sumCampo = 0;
      let sumAcc = 0;
      let hasCampoCustom = false;

      allProjectsData.forEach(({ project, data }) => {
        const t2 = Array.isArray(data) ? data : (Array.isArray(data?.table2) ? data.table2 : []);
        const row = t2.find(r => r?.semana && getRowGroupingKey(project, r.semana).key === g.key);
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
        semana: g.label,
        _year: g.calYear,
        _week: g.calWeekNo,
        actos: sumActos,
        condiciones: sumCondiciones,
        incidencias_campo: hasCampoCustom ? sumCampo : '',
        accidentes_incapacitantes: sumAcc
      };

      return calculateRowValues(baseRow);
    });

    return { table1Rows: t1Rows, table2Rows: t2Rows, availableYears: yearList.slice().reverse() };
  }, [projects, allTasks, refreshIndex]);

  // Filas del año elegido ('ALL' = todos los años). En la vista de un solo año
  // el eje muestra "SEM n" (el año ya está en el filtro).
  const filterByYear = (rows, year) => (year === 'ALL' ? rows : rows.filter(r => String(r._year) === String(year)));
  const axisLabel = (r, year) => (year === 'ALL' ? (r.semana || '') : `SEM ${r._week}`);
  const yearOptionLabel = (y) => (y === currentIsoYear ? `${y} (sem 1 – ${isoWeek(new Date()).week})` : `${y}`);

  const rowsToUse1 = filterByYear(table1Rows, selectedYear1);

  const labels1 = rowsToUse1.map(r => axisLabel(r, selectedYear1));
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
        label: 'META Frecuencia (2.0)',
        data: metaData1,
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'BAJO Frecuencia (1.0)',
        data: bajoData1,
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'ALTO Frecuencia (3.5)',
        data: altoData1,
        borderColor: '#ef4444',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
    ],
  };

  const rowsToUse2 = filterByYear(table2Rows, selectedYear2);

  const labels2 = rowsToUse2.map(r => axisLabel(r, selectedYear2));
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

  const rowsToUse3 = filterByYear(table2Rows, selectedYear3);

  const labels3 = rowsToUse3.map(r => axisLabel(r, selectedYear3));

  // Las HH vienen de la tabla 1; se busca por la etiqueta completa
  // ("SEM n · año"), que es única entre años.
  const getHHForIndexGen = (semana) => {
    const t1Row = table1Rows.find(r => r.semana === semana);
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
        label: 'Tasa IF (por 1M de HH)',
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
      {
        label: 'META IF (Tasa 10.0)',
        data: rowsToUse3.map(() => 10.0),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'BAJO IF (Tasa 5.0)',
        data: rowsToUse3.map(() => 5.0),
        borderColor: '#f59e0b',
        borderDash: [5, 5],
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label: 'ALTO IF (Tasa 25.0)',
        data: rowsToUse3.map(() => 25.0),
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
                `Valor Umbral: ${context.parsed.y}`,
                `Significado: ${desc} (NO es conteo de accidentes)`
              ];
            }
            const idx = context.dataIndex;
            const row = rowsToUse3[idx] || {};
            const acc = calculateRowValues(row).accidentes_incapacitantes || 0;
            const hh = getHHForIndexGen(row.semana, idx);
            return [
              `Tasa IF: ${context.parsed.y} (por 1M de HH)`,
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


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Selector de Modo de Agrupación Temporal */}
      <div className="glass-card" style={{
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        background: isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
        border: '1px solid rgba(148, 163, 175, 0.2)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px'
          }}>
            <FiClock />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
              Semanas ISO 8601
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: isDarkMode ? '#94a3b8' : '#64748b', maxWidth: '760px', lineHeight: '1.4' }}>
              Los datos de todos los proyectos se suman por semana del calendario (lunes a domingo; la semana 1 es la que
              contiene el primer jueves del año). La semana de cada registro se calcula a partir de la fecha de inicio del proyecto. Cada gráfica se filtra por año: del año en curso se muestran de la semana 1 a la actual.
            </p>
          </div>
        </div>

        {(() => {
          const now = isoWeek(new Date());
          return (
            <div style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(241, 245, 249, 0.9)',
              border: '1px solid rgba(148, 163, 175, 0.2)',
              color: isDarkMode ? '#cbd5e1' : '#475569'
            }}>
              🗓️ Semana actual: {now.week} · {now.year} ({isoWeekRangeLabel(now.year, now.week)})
            </div>
          );
        })()}
      </div>

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
            <label htmlFor="year-select-gen1" style={{ fontSize: '13px', fontWeight: '500' }}>Año:</label>
            <select
              id="year-select-gen1"
              value={selectedYear1}
              onChange={(e) => setSelectedYear1(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={String(y)}>{yearOptionLabel(y)}</option>
              ))}
              {availableYears.length > 1 && <option value="ALL">Todos los años</option>}
            </select>
          </div>
        </div>

        {selectedYear1 !== 'ALL' && rowsToUse1.length > 0 && (() => {
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
              <strong style={{ color: isDarkMode ? '#fde68a' : '#b45309' }}>BAJO (Tasa 1.0):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Nivel óptimo de control de seguridad. Refleja muy pocas incidencias por cada 1,000 HH corregidas.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981', marginTop: '2px', flexShrink: 0 }}></span>
            <div>
              <strong style={{ color: isDarkMode ? '#a7f3d0' : '#047857' }}>META (Tasa 2.0):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Promedio objetivo industrial. Indica una operación bajo supervisión dentro del margen controlable.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', marginTop: '2px', flexShrink: 0 }}></span>
            <div>
              <strong style={{ color: isDarkMode ? '#fecaca' : '#b91c1c' }}>ALTO (Tasa 3.5):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Límite crítico superior. Concentración alta de actos y condiciones inseguras que requiere intervención.</div>
            </div>
          </div>
        </div>

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
            <label htmlFor="year-select-gen2" style={{ fontSize: '13px', fontWeight: '500' }}>Año:</label>
            <select
              id="year-select-gen2"
              value={selectedYear2}
              onChange={(e) => setSelectedYear2(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={String(y)}>{yearOptionLabel(y)}</option>
              ))}
              {availableYears.length > 1 && <option value="ALL">Todos los años</option>}
            </select>
          </div>
        </div>

        {selectedYear2 !== 'ALL' && rowsToUse2.length > 0 && (() => {
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
              Tasa de Frecuencia de Accidentes (IF) General
            </h3>
            <span className="chart-subtitle" style={{ display: 'block', marginTop: '4px', color: isDarkMode ? '#cbd5e1' : '#475569' }}>
              <strong>Nota:</strong> Muestra el <em>Índice de Frecuencia (Tasa por cada 1,000,000 HH)</em>, NO la cantidad de accidentes reales. Fórmula: (No. de Accidentes × 1,000,000) ÷ HH.
            </span>
          </div>
          
          <div className="chart-week-filter" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="year-select-gen3" style={{ fontSize: '13px', fontWeight: '500' }}>Año:</label>
            <select
              id="year-select-gen3"
              value={selectedYear3}
              onChange={(e) => setSelectedYear3(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={String(y)}>{yearOptionLabel(y)}</option>
              ))}
              {availableYears.length > 1 && <option value="ALL">Todos los años</option>}
            </select>
          </div>
        </div>

        {selectedYear3 !== 'ALL' && rowsToUse3.length > 0 && (() => {
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
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Accidentes Reales (Acum.)</span>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isDarkMode ? '#fbbf24' : '#d97706', marginTop: '4px' }}>{accumAcc}</div>
              </div>
              <div className="kpi-item">
                <span style={{ fontSize: '11px', textTransform: 'uppercase' }}>Tasa IF Acumulada (por 1M HH)</span>
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
              <strong style={{ color: isDarkMode ? '#fde68a' : '#b45309' }}>BAJO IF (Tasa 5.0):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Nivel de excelencia en seguridad. Refleja un índice óptimo con mínima accidentabilidad por cada millón de horas.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#10b981', marginTop: '2px', flexShrink: 0 }}></span>
            <div>
              <strong style={{ color: isDarkMode ? '#a7f3d0' : '#047857' }}>META IF (Tasa 10.0):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Promedio industrial objetivo por millón de horas trabajadas. Representa un índice de accidentabilidad controlado.</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', backgroundColor: '#ef4444', marginTop: '2px', flexShrink: 0 }}></span>
            <div>
              <strong style={{ color: isDarkMode ? '#fecaca' : '#b91c1c' }}>ALTO IF (Tasa 25.0):</strong>
              <div style={{ color: isDarkMode ? '#cbd5e1' : '#475569', fontSize: '11px', marginTop: '2px' }}>Límite crítico superior de alerta roja. Superar esta tasa exige investigación e intervención prioritaria.</div>
            </div>
          </div>
        </div>

        <div className="chart-container-box">
          <Line data={data3} options={options} />
        </div>
      </div>
    </div>
  );
};

export default GeneralGraficasReports;
