import api from './api';

export const getDashboardData = async () => {
  try {
    const { data } = await api.get('reports/dashboard/');
    return data;
  } catch (error) {
    console.error("Error al obtener los datos del dashboard:", error);
    throw error;
  }
};