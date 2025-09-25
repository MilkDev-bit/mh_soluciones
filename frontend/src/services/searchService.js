import api from './api';

export const globalSearch = async (query) => {
  if (!query || query.length < 3) {
    return [];
  }
  try {
    const { data } = await api.get(`/search/?q=${query}`);
    return data;
  } catch (error) {
    console.error("Error en la búsqueda global:", error);
    return [];
  }
};