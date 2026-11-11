import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  FiActivity, FiAlertTriangle, FiCalendar, FiCheckCircle, FiClipboard, FiClock, FiShield, FiXCircle,
} from 'react-icons/fi';
import { getProjectProgressStats } from '../../services/projectService';
import './ProjectProgressCharts.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

/*
 * [CAMBIO] "Estado del Proyecto": métricas que muestran cómo va la obra AHORA,
 * con el mismo criterio que el reporte semanal de entregables:
 *  - cumplimiento de la semana en curso y de la anterior (X de 7 + semáforo),
 *  - puntualidad, revisión pendiente y avance en el tiempo,
 *  - tendencia del cumplimiento semanal,
 *  - índice de frecuencia (tabla de GRÁFICAS) contra las metas.
 * Antes: pastel de estados de tarea que ya no se usan y tareas por prioridad.
 */

// Colores de estado (semáforo del reporte): siempre acompañados de icono + texto.
const STATUS = {
  green: { color: '#10b981', label: 'Al día', Icon: FiCheckCircle },
  yellow: { color: '#f59e0b', label: 'Atención', Icon: FiAlertTriangle },
  red: { color: '#ef4444', label: 'Crítico', Icon: FiXCircle },
};
const INK_MUTED = '#9ca3af';
const GRID = 'rgba(148, 163, 184, 0.18)';
const IF_LINE = '#f97316';
const METAS = [
  { value: 1.0, label: 'Bajo 1.0', color: '#f59e0b' },
  { value: 2.0, label: 'Meta 2.0', color: '#10b981' },
  { value: 3.5, label: 'Alto 3.5', color: '#ef4444' },
];

const StatusBadge = ({ color }) => {
  const s = STATUS[color] || STATUS.red;
  const { Icon } = s;
  return (
    <span className={`status-badge status-${color}`}>
      <Icon aria-hidden="true" /> {s.label}
    </span>
  );
};

const WeekTile = ({ title, week, current }) => {
  if (!week) {
    return (
      <div className="kpi-tile">
        <span className="kpi-title"><FiCalendar /> {title}</span>
        <p className="kpi-empty">El proyecto aún no había iniciado.</p>
      </div>
    );
  }
  return (
    <div className={`kpi-tile kpi-week ${current ? 'is-current' : ''}`}>
      <span className="kpi-title"><FiCalendar /> {title}</span>
      <div className="kpi-main">
        <span className="kpi-value">{week.done}<small> de {week.total}</small></span>
        <StatusBadge color={week.color} />
      </div>
      <span className="kpi-sub">{week.label} · {week.range}{current ? ' (en curso)' : ''}</span>
      {week.missing.length > 0 ? (
        <p className="kpi-missing"><strong>Falta:</strong> {week.missing.join(', ')}</p>
      ) : (
        <p className="kpi-missing ok">Todos los entregables completos</p>
      )}
      {week.late > 0 && <p className="kpi-note">{week.late} entregada(s) tarde</p>}
    </div>
  );
};

const ProjectProgressCharts = ({ projectId }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      if (!projectId) return;
      try {
        setLoading(true);
        setStats(await getProjectProgressStats(projectId));
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
        <p>Cargando estado del proyecto...</p>
      </div>
    );
  }

  if (error || !stats || !stats.trend) {
    return (
      <div className="charts-error">
        <p>{error || 'No hay estadísticas disponibles'}</p>
      </div>
    );
  }

  const { current, previous, trend, punctuality, safety, review, timeline } = stats;

  // ---- Puntualidad (semanas ya cerradas)
  const puntTotal = punctuality.on_time + punctuality.late + punctuality.missing;
  const pct = (n) => (puntTotal ? Math.round((n / puntTotal) * 100) : 0);

  // ---- Tendencia de cumplimiento semanal (barras con color de semáforo)
  const lastIdx = trend.length - 1;
  const trendData = {
    labels: trend.map((t) => t.label),
    datasets: [{
      label: '% de cumplimiento',
      data: trend.map((t) => t.pct),
      backgroundColor: trend.map((t, i) => `${STATUS[t.color].color}${i === lastIdx ? '80' : 'E6'}`),
      borderColor: trend.map((t) => STATUS[t.color].color),
      borderWidth: trend.map((_, i) => (i === lastIdx ? 2 : 0)),
      borderRadius: 4,
      borderSkipped: 'bottom',
      maxBarThickness: 44,
    }],
  };
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const t = trend[items[0].dataIndex];
            return `${t.label} · ${t.range}${items[0].dataIndex === lastIdx ? ' (en curso)' : ''}`;
          },
          label: (ctx) => {
            const t = trend[ctx.dataIndex];
            return ` ${t.done} de ${t.total} entregables (${t.pct}%) — ${STATUS[t.color].label}`;
          },
        },
      },
    },
    scales: {
      y: {
        min: 0, max: 100,
        ticks: { stepSize: 25, color: INK_MUTED, callback: (v) => `${v}%` },
        grid: { color: GRID },
        border: { display: false },
      },
      x: { ticks: { color: INK_MUTED }, grid: { display: false } },
    },
  };

  // ---- Índice de frecuencia (una sola escala) con las metas como referencia
  const ifValues = safety.map((s) => s.indice);
  const hayIndice = ifValues.some((v) => v !== null);
  const maxIF = Math.max(4, ...ifValues.filter((v) => v !== null).map((v) => Math.ceil(v + 0.5)));
  const ifData = {
    labels: safety.map((s) => s.label),
    datasets: [
      {
        label: 'Índice de frecuencia',
        data: ifValues,
        borderColor: IF_LINE,
        backgroundColor: IF_LINE,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: 'transparent',
        tension: 0.25,
        spanGaps: false,
      },
      ...METAS.map((m) => ({
        label: m.label,
        data: safety.map(() => m.value),
        borderColor: m.color,
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false,
      })),
    ],
  };
  const ifOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'line', color: INK_MUTED, boxWidth: 24, padding: 14 },
      },
      tooltip: {
        filter: (item) => item.datasetIndex === 0,
        callbacks: {
          title: (items) => {
            const s = safety[items[0].dataIndex];
            return `${s.label} del proyecto · ${s.range}${s.current ? ' (en curso)' : ''}`;
          },
          label: (ctx) => {
            const s = safety[ctx.dataIndex];
            return s.indice === null ? ' Sin FT capturado' : ` Índice de frecuencia: ${s.indice}`;
          },
          afterLabel: (ctx) => {
            const s = safety[ctx.dataIndex];
            return [
              `Actos inseguros: ${s.actos}`,
              `Condiciones inseguras: ${s.condiciones}`,
              `Horas-hombre: ${s.hh.toLocaleString('es-MX')}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        min: 0, suggestedMax: maxIF,
        ticks: { color: INK_MUTED },
        grid: { color: GRID },
        border: { display: false },
      },
      x: { ticks: { color: INK_MUTED }, grid: { display: false } },
    },
  };

  const sinCaptura = timeline.weeks_without_capture;

  return (
    <div className="project-progress-charts">
      <div className="charts-header">
        <h3><FiActivity /> Estado del Proyecto</h3>
      </div>

      <div className="kpi-grid">
        <WeekTile title="Esta semana" week={current} current />
        <WeekTile title="Semana anterior" week={previous} />

        <div className="kpi-tile">
          <span className="kpi-title"><FiClock /> Puntualidad</span>
          {puntTotal > 0 ? (
            <>
              <span className="kpi-value">{pct(punctuality.on_time)}%<small> a tiempo</small></span>
              <div className="punct-bar" role="img"
                   aria-label={`${punctuality.on_time} a tiempo, ${punctuality.late} tarde, ${punctuality.missing} sin entregar`}>
                <span className="seg on-time" style={{ width: `${pct(punctuality.on_time)}%` }} />
                <span className="seg late" style={{ width: `${pct(punctuality.late)}%` }} />
                <span className="seg missing" style={{ width: `${pct(punctuality.missing)}%` }} />
              </div>
              <ul className="punct-legend">
                <li><i className="on-time" /> A tiempo <strong>{punctuality.on_time}</strong></li>
                <li><i className="late" /> Tarde <strong>{punctuality.late}</strong></li>
                <li><i className="missing" /> Sin entregar <strong>{punctuality.missing}</strong></li>
              </ul>
              <span className="kpi-sub">Últimas {punctuality.weeks} semana(s) cerradas</span>
            </>
          ) : (
            <p className="kpi-empty">Aún no hay semanas cerradas.</p>
          )}
        </div>

        <div className="kpi-tile">
          <span className="kpi-title"><FiClipboard /> Revisión</span>
          <span className="kpi-value">{review.pending}<small> por revisar</small></span>
          <ul className="kpi-list">
            <li>Devueltas con cambios <strong>{review.changes_requested}</strong></li>
            <li>Aprobadas <strong>{review.approved}</strong></li>
            <li>Calificación promedio <strong>{review.avg_score ?? '—'}</strong></li>
            <li>Entregas totales <strong>{review.total_submissions}</strong></li>
          </ul>
        </div>

        <div className="kpi-tile">
          <span className="kpi-title"><FiShield /> Avance y gráficas</span>
          {timeline.pct_time !== null ? (
            <>
              <span className="kpi-value">{timeline.pct_time}%<small> del tiempo</small></span>
              <div className="time-bar" role="img" aria-label={`${timeline.pct_time}% del tiempo planeado`}>
                <span style={{ width: `${timeline.pct_time}%` }} />
              </div>
              <span className="kpi-sub">Día {timeline.days_elapsed} de {timeline.days_total}</span>
            </>
          ) : (
            <span className="kpi-value">{timeline.days_elapsed ?? 0}<small> días en obra</small></span>
          )}
          <p className={`kpi-missing ${sinCaptura === 0 ? 'ok' : ''}`}>
            {timeline.last_capture
              ? <>Última captura de gráficas: <strong>{timeline.last_capture}</strong>
                  {sinCaptura > 0 && <> (hace {sinCaptura} semana{sinCaptura > 1 ? 's' : ''})</>}</>
              : 'Sin captura de gráficas'}
          </p>
          {timeline.project_week && (
            <span className="kpi-sub">El proyecto va en la SEMANA {timeline.project_week}</span>
          )}
          <span className="kpi-sub">{timeline.hh_total.toLocaleString('es-MX')} horas-hombre acumuladas</span>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h4><FiCheckCircle /> Cumplimiento semanal de entregables</h4>
          <p className="chart-hint">% de los 7 entregables por semana ISO. La última barra es la semana en curso.</p>
          <div className="chart-wrapper">
            <Bar data={trendData} options={trendOptions} />
          </div>
        </div>

        <div className="chart-container">
          <h4><FiShield /> Índice de frecuencia por semana</h4>
          <p className="chart-hint">
            Por semana del proyecto (SEMANA n desde su inicio, como en la tabla de gráficas).
            (Actos + condiciones) / (HH / 1000).
          </p>
          <div className="chart-wrapper">
            {hayIndice ? (
              <Line data={ifData} options={ifOptions} />
            ) : (
              <div className="chart-empty-msg">No hay FT capturado en la tabla de gráficas en estas semanas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressCharts;
