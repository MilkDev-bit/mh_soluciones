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