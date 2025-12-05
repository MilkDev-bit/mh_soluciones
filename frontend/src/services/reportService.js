import api from './api';

export const getDashboardData = async () => {
  try {
    const response = await api.get('/reports/dashboard/');
    return response.data;
  } catch (error) {
    throw error;
  }
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