/**
 * Semanas ISO 8601: van de lunes a domingo y la semana 1 de un año es la que
 * contiene su primer jueves (por eso el 1 de enero puede caer en la semana
 * 52/53 del año anterior y el 31 de diciembre en la semana 1 del siguiente).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * 'YYYY-MM-DD' → fecha LOCAL (new Date('2026-11-10') la interpreta como
 * medianoche UTC y en México cae en el día anterior). Acepta también fechas
 * con hora y objetos Date.
 */
export const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** { year, week } ISO de una fecha (usa el día local). */
export const isoWeek = (value) => {
  const date = parseLocalDate(value);
  if (!date) return null;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // jueves de esa semana
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7);
  return { year, week };
};

/** Lunes (00:00 local) de la semana ISO indicada. */
export const isoWeekStart = (year, week) => {
  const jan4 = new Date(year, 0, 4);
  const mondayWeek1 = new Date(year, 0, 4 - ((jan4.getDay() || 7) - 1));
  return new Date(mondayWeek1.getFullYear(), mondayWeek1.getMonth(), mondayWeek1.getDate() + (week - 1) * 7);
};

/** Domingo (23:59:59.999 local) de la semana ISO indicada. */
export const isoWeekEnd = (year, week) => {
  const start = isoWeekStart(year, week);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);
};

/** 52 o 53 semanas según el año. */
export const isoWeeksInYear = (year) => isoWeek(new Date(year, 11, 28)).week;

/** Clave ordenable: 202646 para la semana 46 de 2026. */
export const isoWeekKey = ({ year, week }) => year * 100 + week;

/** "10–16 nov" o "29 dic – 4 ene". */
export const isoWeekRangeLabel = (year, week) => {
  const s = isoWeekStart(year, week);
  const e = isoWeekEnd(year, week);
  return s.getMonth() === e.getMonth()
    ? `${s.getDate()}–${e.getDate()} ${MONTHS[e.getMonth()]}`
    : `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
};

/** Etiqueta corta usada en tablas y gráficas: "SEM 46 · 2026". */
export const isoWeekLabel = ({ year, week }) => `SEM ${week} · ${year}`;

/** Lee "2026-W46" / "2026-W46-1" si una fila ya guarda la semana ISO. */
export const parseIsoWeekString = (text) => {
  const m = /(\d{4})-?W(\d{1,2})/i.exec(String(text || ''));
  return m ? { year: Number(m[1]), week: Number(m[2]) } : null;
};
