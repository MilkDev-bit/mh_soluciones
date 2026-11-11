/*
 * Piezas compartidas por "Estado del Proyecto" (detalle de un proyecto) y
 * "Estado general de las obras" (Panel de Control): semáforo y configuración
 * de las gráficas de cumplimiento semanal e índice de frecuencia.
 */
import React from 'react';
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
import { FiAlertTriangle, FiCheckCircle, FiXCircle } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// Colores de estado (semáforo del reporte): siempre acompañados de icono + texto.
export const STATUS = {
  green: { color: '#10b981', label: 'Al día', Icon: FiCheckCircle },
  yellow: { color: '#f59e0b', label: 'Atención', Icon: FiAlertTriangle },
  red: { color: '#ef4444', label: 'Crítico', Icon: FiXCircle },
};
export const INK_MUTED = '#9ca3af';
export const GRID = 'rgba(148, 163, 184, 0.18)';
const IF_LINE = '#f97316';
const METAS = [
  { value: 1.0, label: 'Bajo 1.0', color: '#f59e0b' },
  { value: 2.0, label: 'Meta 2.0', color: '#10b981' },
  { value: 3.5, label: 'Alto 3.5', color: '#ef4444' },
];

export const StatusBadge = ({ color }) => {
  const s = STATUS[color] || STATUS.red;
  const { Icon } = s;
  return (
    <span className={`status-badge status-${color}`}>
      <Icon aria-hidden="true" /> {s.label}
    </span>
  );
};

/**
 * Barras del % de cumplimiento semanal con el color del semáforo. La última
 * barra (semana en curso) va más clara. `extraLines(t)` agrega líneas al tooltip.
 */
export const buildTrendChart = (trend, extraLines) => {
  const lastIdx = trend.length - 1;
  const data = {
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
  const options = {
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
          afterLabel: (ctx) => (extraLines ? extraLines(trend[ctx.dataIndex]) : []),
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
  return { data, options };
};

/**
 * Línea del índice de frecuencia (una sola escala) con las metas 1.0 / 2.0 / 3.5
 * como referencia. `titleFor(s)` arma el título del tooltip.
 */
export const buildIfChart = (safety, titleFor) => {
  const values = safety.map((s) => s.indice);
  const hasData = values.some((v) => v !== null);
  const maxIF = Math.max(4, ...values.filter((v) => v !== null).map((v) => Math.ceil(v + 0.5)));
  const data = {
    labels: safety.map((s) => s.label),
    datasets: [
      {
        label: 'Índice de frecuencia',
        data: values,
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
  const options = {
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
          title: (items) => titleFor(safety[items[0].dataIndex]),
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
      y: { min: 0, suggestedMax: maxIF, ticks: { color: INK_MUTED }, grid: { color: GRID }, border: { display: false } },
      x: { ticks: { color: INK_MUTED }, grid: { display: false } },
    },
  };
  return { data, options, hasData };
};
