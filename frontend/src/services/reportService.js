// services/reportService.js
import api from './api';

export const getDashboardData = async () => {
  try {
    const response = await api.get('/reports/dashboard/');
    return response.data;
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
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
    console.error('Error performing global search:', error);
    throw error;
  }
};