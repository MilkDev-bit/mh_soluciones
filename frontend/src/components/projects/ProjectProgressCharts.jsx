import React, { useEffect, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  FiActivity, FiCalendar, FiCheckCircle, FiClipboard, FiClock, FiShield,
} from 'react-icons/fi';
import { getProjectProgressStats } from '../../services/projectService';
import { StatusBadge, buildIfChart, buildTrendChart } from './statusCharts';
import './ProjectProgressCharts.scss';

/*
 * [CAMBIO] "Estado del Proyecto": métricas que muestran cómo va la obra AHORA,
 * con el mismo criterio que el reporte semanal de entregables:
 *  - cumplimiento de la semana en curso y de la anterior (X de 7 + semáforo),
 *  - puntualidad, revisión pendiente y avance en el tiempo,
 *  - tendencia del cumplimiento semanal,
 *  - índice de frecuencia (tabla de GRÁFICAS, por semana del proyecto).
 * Antes: pastel de estados de tarea que ya no se usan y tareas por prioridad.
 */

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

  // ---- Tendencia de cumplimiento semanal e índice de frecuencia
  const trendChart = buildTrendChart(trend);
  const ifChart = buildIfChart(
    safety,
    (s) => `${s.label} del proyecto · ${s.range}${s.current ? ' (en curso)' : ''}`,
  );

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
            <Bar data={trendChart.data} options={trendChart.options} />
          </div>
        </div>

        <div className="chart-container">
          <h4><FiShield /> Índice de frecuencia por semana</h4>
          <p className="chart-hint">
            Por semana del proyecto (SEMANA n desde su inicio, como en la tabla de gráficas).
            (Actos + condiciones) / (HH / 1000).
          </p>
          <div className="chart-wrapper">
            {ifChart.hasData ? (
              <Line data={ifChart.data} options={ifChart.options} />
            ) : (
              <div className="chart-empty-msg">No hay FT capturado en la tabla de gráficas en estas semanas.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { WeekTile };
export default ProjectProgressCharts;
