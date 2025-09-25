const statusTranslations = {
  PLANNING: 'Planificación',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completado',
  ON_HOLD: 'En Pausa',
  CANCELLED: 'Cancelado',
};

export const translateStatus = (status) => {
  return statusTranslations[status] || status.replace('_', ' ');
};