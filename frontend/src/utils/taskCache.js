/**
 * Invalida en React Query todo lo que muestra el estado de las tareas.
 *
 * Cada pantalla tiene su propia caché (Tareas: 5 min, Panel de Control: 1 min,
 * detalle del proyecto, reportes…). Antes, al cerrar/ampliar/aprobar una tarea
 * desde un proyecto, solo se refrescaba esa vista y en las demás seguía
 * apareciendo con el estado anterior hasta recargar la página.
 */
export const TASK_QUERY_KEYS = [
  ['tasks'],
  ['projectTasks'],
  ['projectTaskDocuments'],
  ['taskDocuments'],
  ['dashboard'],
  ['project'],
  ['projects'],
  ['statistics'],
  ['allTasksForGeneralReports'],
];

export const invalidateTaskQueries = (queryClient) => {
  if (!queryClient) return;
  TASK_QUERY_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
};
