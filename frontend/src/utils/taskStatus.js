/**
 * Etiquetas, colores y helpers de fechas para tareas y entregas.
 *
 * Regla principal: el FRONTEND YA NO DECIDE SI UNA TAREA VENCE.
 * El servidor envía `deadline` (ISO con zona horaria), `is_overdue` y, para
 * alumnos, `my_window` ({ state, can_submit, is_late, message, deadline, ... }).
 * Antes se hacía `isPast(parseISO(due_date))`, que marcaba la tarea como
 * vencida desde las 00:00 del día límite, y `new Date('2026-11-15')`, que en
 * México se interpreta como el 14 a las 18:00 (UTC).
 */
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- Estado global de la tarea (incluye los heredados) -----------------------
export const TASK_STATUS = {
  DRAFT: { label: 'Borrador', className: 'status-draft' },
  OPEN: { label: 'Abierta', className: 'status-pending' },
  REOPENED: { label: 'Reabierta', className: 'status-progress' },
  IN_REVIEW: { label: 'En revisión', className: 'status-review' },
  CLOSED: { label: 'Cerrada', className: 'status-completed' },
  PENDING: { label: 'Pendiente', className: 'status-pending' },
  IN_PROGRESS: { label: 'En progreso', className: 'status-progress' },
  FOR_REVIEW: { label: 'En revisión', className: 'status-review' },
  COMPLETED: { label: 'Completada', className: 'status-completed' },
};

export const taskStatusLabel = (task) =>
  task?.status_display || TASK_STATUS[task?.status]?.label || task?.status || '';

export const taskStatusClass = (status) => TASK_STATUS[status]?.className || 'status-pending';

export const isTaskDone = (task) => ['COMPLETED', 'CLOSED'].includes(task?.status);

// --- Estado de cada entrega (flujo de revisión por alumno) -------------------
export const SUBMISSION_STATUS = {
  SUBMITTED: { label: 'Por revisar', className: 'status-submitted', color: '#3b82f6' },
  IN_REVIEW: { label: 'En revisión', className: 'status-review', color: '#8b5cf6' },
  CHANGES_REQUESTED: { label: 'Devuelta con cambios', className: 'status-late', color: '#f59e0b' },
  APPROVED: { label: 'Aprobada', className: 'status-graded', color: '#10b981' },
  GRADED: { label: 'Calificada', className: 'status-graded', color: '#10b981' },
  SUPERSEDED: { label: 'Reemplazada', className: 'status-pending', color: '#94a3b8' },
  LATE: { label: 'Por revisar', className: 'status-submitted', color: '#3b82f6' },
  PENDING: { label: 'Pendiente', className: 'status-pending', color: '#94a3b8' },
};

export const submissionStatusLabel = (sub) =>
  SUBMISSION_STATUS[sub?.status]?.label || sub?.status_display || sub?.status || '';

export const submissionStatusClass = (sub) =>
  SUBMISSION_STATUS[sub?.status]?.className || 'status-pending';

// --- Estado del tablero de revisión (una fila por alumno) --------------------
export const BOARD_STATE = {
  TO_REVIEW: { label: 'Por revisar', color: '#3b82f6' },
  IN_REVIEW: { label: 'En revisión', color: '#8b5cf6' },
  CHANGES_REQUESTED: { label: 'Esperando corrección', color: '#f59e0b' },
  MISSING: { label: 'Sin entrega', color: '#ef4444' },
  APPROVED: { label: 'Aprobada', color: '#10b981' },
};

// --- Ventana de entrega del alumno (my_window.state) -------------------------
export const WINDOW_STATE = {
  NO_DEADLINE: { label: 'Actividad continua', tone: 'info' },
  OPEN: { label: 'Abierta', tone: 'info' },
  DUE_SOON: { label: 'Vence pronto', tone: 'warning' },
  LATE_WINDOW: { label: 'Entrega tardía permitida', tone: 'warning' },
  CORRECTION: { label: 'Corrección pendiente', tone: 'warning' },
  OVERDUE: { label: 'Vencida', tone: 'danger' },
  NOT_OPEN: { label: 'Aún no abre', tone: 'info' },
  IN_REVIEW: { label: 'En revisión', tone: 'info' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  CLOSED: { label: 'Cerrada', tone: 'danger' },
};

export const TONE_COLORS = {
  info: { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
  danger: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  success: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
};

// --- Fechas ------------------------------------------------------------------

/** 'YYYY-MM-DD' de HOY en la hora local del navegador (no UTC). */
export const todayLocalISO = () => format(new Date(), 'yyyy-MM-dd');

/** Formatea un ISO del servidor (con zona horaria) en hora local. */
export const formatDateTime = (iso, pattern = "dd MMM yyyy, HH:mm") => {
  if (!iso) return null;
  try {
    return format(parseISO(iso), pattern, { locale: es });
  } catch {
    return null;
  }
};

/**
 * Fecha límite a mostrar: usa `deadline` del servidor; si no existe (API vieja),
 * cae a due_date como fecha local, sin desplazarla por UTC.
 */
export const taskDeadlineLabel = (task) => {
  if (task?.is_continuous) return 'Sin vencimiento (actividad continua)';
  if (task?.deadline) return formatDateTime(task.deadline, "dd MMM yyyy 'a las' HH:mm");
  if (task?.due_date) return format(parseISO(task.due_date), 'dd MMM yyyy', { locale: es });
  return null;
};

/** Fecha límite como Date (para filtros como "esta semana"). */
export const taskDeadlineDate = (task) => {
  if (task?.deadline) return parseISO(task.deadline);
  if (task?.due_date) return parseISO(`${task.due_date}T23:59:59`); // fin del día local
  return null;
};

/** Mensaje de error de la API (todas las formas que devuelve el backend). */
export const apiErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  const data = error.response?.data || error;
  if (typeof data === 'string') return data;
  return data.error || data.detail || data.message ||
    (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) ||
    (error.message && !error.stack ? error.message : null) ||
    fallback;
};
