import api from './api';

export const getDashboardData = async () => {
  try {
    const response = await api.get('/reports/dashboard/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getStatistics = async (rango, proyectoId = '', usuarioId = '') => {
  const params = new URLSearchParams();
  if (rango) params.append('rango', rango);
  if (proyectoId) params.append('proyecto', proyectoId);
  if (usuarioId) params.append('usuario', usuarioId);

  const response = await api.get(`/reports/statistics/?${params.toString()}`);
  return response.data;
};

export const globalSearch = async (query) => {
  try {
    const response = await api.get('/reports/search/', {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
/**
 * Descarga el reporte semanal de entregables (.xlsx) de la semana ISO indicada.
 * Devuelve { blob, filename }.
 */
export const downloadEntregablesReport = async (year, week) => {
  const response = await api.get('/reports/entregables/', {
    params: { year, week },
    responseType: 'blob',
  });
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return {
    blob: response.data,
    filename: match ? match[1] : `Entregables-SEM-${week}-${year}.xlsx`,
  };
};

/**
 * Estado general de las obras en proceso (Panel de Control de Admin / Superadmin).
 */
export const getGeneralStatus = async ({ refresh = false } = {}) => {
  const { data } = await api.get('/reports/general-status/', { params: refresh ? { refresh: 1 } : {} });
  return data;
};
