import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bar, Line } from 'react-chartjs-2';
import {
  FiActivity, FiCalendar, FiCheckCircle, FiChevronDown, FiChevronUp, FiClipboard, FiClock, FiRefreshCw, FiShield,
} from 'react-icons/fi';
import { getGeneralStatus } from '../../services/reportService';
import { STATUS, StatusBadge, buildIfChart, buildTrendChart } from '../projects/statusCharts';
import '../projects/ProjectProgressCharts.scss';
import './GeneralStatusWidget.scss';

/*
 * Estado general de las obras en proceso (Panel de Control de Admin y
 * Superadmin): las métricas de "Estado del Proyecto" sumadas para todos los
 * proyectos En Progreso, con el criterio del reporte de entregables.
 */

const ObrasPorColor = ({ week }) => (
  <ul className="obras-color" aria-label="Obras por semáforo">
    {['green', 'yellow', 'red'].map((c) => (
      <li key={c} className={`status-${c}`}>
        <span className="dot" style={{ background: STATUS[c].color }} />
        {STATUS[c].label} <strong>{week[c]}</strong>
      </li>
    ))}
  </ul>
);

const GeneralWeekTile = ({ title, week, current }) => (
  <div className={`kpi-tile kpi-week ${current ? 'is-current' : ''}`}>
    <span className="kpi-title"><FiCalendar /> {title}</span>
    {week ? (
      <>
        <div className="kpi-main">
          <span className="kpi-value">{week.pct}%<small> entregado</small></span>
          <StatusBadge color={week.color} />
        </div>
        <span className="kpi-sub">
          {week.done} de {week.total} entregables · {week.label} · {week.range}{current ? ' (en curso)' : ''}
        </span>
        <ObrasPorColor week={week} />
        {week.top_missing?.length > 0 && (
          <p className="kpi-missing">
            <strong>Lo que más falta:</strong>{' '}
            {week.top_missing.map((m) => `${m.name} (${m.projects})`).join(', ')}
          </p>
        )}
      </>
    ) : (
      <p className="kpi-empty">Sin datos.</p>
    )}
  </div>
);

const ATTENTION_PREVIEW = 8;

const GeneralStatusWidget = () => {
  const queryClient = useQueryClient();
  const [verTodas, setVerTodas] = useState(false);
  const [verSinCaptura, setVerSinCaptura] = useState(false);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['general-status'],
    queryFn: () => getGeneralStatus(),
    staleTime: 5 * 60 * 1000,
  });

  const refrescar = async () => {
    const fresh = await getGeneralStatus({ refresh: true });
    queryClient.setQueryData(['general-status'], fresh);
  };

  if (isLoading) {
    return (
      <div className="charts-loading">
        <div className="loading-spinner"></div>
        <p>Calculando el estado de las obras...</p>
      </div>
    );
  }
  if (error || !data) {
    return <div className="charts-error"><p>No se pudo cargar el estado general de las obras.</p></div>;
  }

  const { current, previous, trend, punctuality, safety, review, graficas, attention } = data;
  const puntTotal = punctuality.on_time + punctuality.late + punctuality.missing;
  const pct = (n) => (puntTotal ? Math.round((n / puntTotal) * 100) : 0);

  const trendChart = buildTrendChart(trend, (t) => [
    `Obras: ${t.projects} — ${STATUS.green.label} ${t.green}, ${STATUS.yellow.label} ${t.yellow}, ${STATUS.red.label} ${t.red}`,
  ]);
  const ifChart = buildIfChart(safety, (s) => `${s.label} · ${s.range}`);
  const atencionVisible = verTodas ? attention : attention.slice(0, ATTENTION_PREVIEW);
  const sinCaptura = graficas.without_capture || [];

  return (
    <div className="project-progress-charts general-status-widget">
      <div className="charts-header general-header">
        <h3><FiActivity /> Estado general de las obras</h3>
        <div className="general-header-meta">
          <span>{data.active_projects} obras en proceso</span>
          <button type="button" className="btn-refresh" onClick={refrescar} disabled={isFetching}
                  title="Volver a calcular">
            <FiRefreshCw className={isFetching ? 'spinning' : ''} /> Actualizar
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <GeneralWeekTile title="Esta semana" week={current} current />
        <GeneralWeekTile title="Semana anterior" week={previous} />

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
              <span className="kpi-sub">Últimas {punctuality.weeks} semanas cerradas, todas las obras</span>
            </>
          ) : (
            <p className="kpi-empty">Aún no hay semanas cerradas.</p>
          )}
        </div>

        <div className="kpi-tile">
          <span className="kpi-title"><FiClipboard /> Revisión</span>
          <span className="kpi-value">{review.pending}<small> por revisar</small></span>
          <ul className="kpi-list">
            <li>Obras con entregas por revisar <strong>{review.projects_with_pending}</strong></li>
            <li>Devueltas con cambios <strong>{review.changes_requested}</strong></li>
            <li>La más antigua espera <strong>
              {review.oldest_pending_days === null ? '—' : `${review.oldest_pending_days} días`}
            </strong></li>
          </ul>
        </div>

        <div className="kpi-tile">
          <span className="kpi-title"><FiShield /> Gráficas</span>
          <span className="kpi-value">{sinCaptura.length}<small> sin capturar</small></span>
          <span className="kpi-sub">Obras sin la tabla de gráficas de la {graficas.week_label || 'semana anterior'}</span>
          {sinCaptura.length > 0 && (
            <>
              <button type="button" className="link-toggle" onClick={() => setVerSinCaptura((v) => !v)}>
                {verSinCaptura ? 'Ocultar' : 'Ver cuáles'} {verSinCaptura ? <FiChevronUp /> : <FiChevronDown />}
              </button>
              {verSinCaptura && (
                <ul className="mini-list">
                  {sinCaptura.map((p) => (
                    <li key={p.project_id}><Link to={`/projects/${p.project_id}`}>{p.name}</Link></li>
                  ))}
                </ul>
              )}
            </>
          )}
          <span className="kpi-sub">{Math.round(graficas.hh_total).toLocaleString('es-MX')} horas-hombre acumuladas</span>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h4><FiCheckCircle /> Cumplimiento semanal de entregables</h4>
          <p className="chart-hint">% de entregables de todas las obras en proceso por semana ISO. La última barra es la semana en curso.</p>
          <div className="chart-wrapper">
            <Bar data={trendChart.data} options={trendChart.options} />
          </div>
        </div>
        <div className="chart-container">
          <h4><FiShield /> Índice de frecuencia general</h4>
          <p className="chart-hint">
            (Actos + condiciones) / (HH / 1000) de todas las obras. Cada SEMANA n de una obra se ubica en su semana ISO.
          </p>
          <div className="chart-wrapper">
            {ifChart.hasData ? (
              <Line data={ifChart.data} options={ifChart.options} />
            ) : (
              <div className="chart-empty-msg">No hay FT capturado en las tablas de gráficas en estas semanas.</div>
            )}
          </div>
        </div>
      </div>

      <div className="attention-block">
        <h4>
          <FiActivity /> Obras que requieren atención
          {previous && <span className="attention-week">{previous.label} · {previous.range}</span>}
        </h4>
        {attention.length === 0 ? (
          <p className="kpi-empty">Todas las obras cumplieron la semana anterior.</p>
        ) : (
          <>
            <div className="attention-table-wrap">
              <table className="attention-table">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th>CRI</th>
                    <th>Cumplimiento</th>
                    <th>Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {atencionVisible.map((a) => (
                    <tr key={a.project_id}>
                      <td><Link to={`/projects/${a.project_id}`}>{a.name}</Link></td>
                      <td className="muted">{a.cri || '—'}</td>
                      <td className="nowrap"><strong>{a.done} de {a.total}</strong> <StatusBadge color={a.color} /></td>
                      <td className="muted">{a.missing.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {attention.length > ATTENTION_PREVIEW && (
              <button type="button" className="link-toggle" onClick={() => setVerTodas((v) => !v)}>
                {verTodas ? 'Ver menos' : `Ver todas (${attention.length})`} {verTodas ? <FiChevronUp /> : <FiChevronDown />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GeneralStatusWidget;
