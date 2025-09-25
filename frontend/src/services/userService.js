import api from './api';

export const getUsers = async () => {
  try {
    const { data } = await api.get('auth/users/');
    return data;
  } catch (error) {
    console.error("Error al obtener los usuarios:", error);
    throw error;
  }
};

export const createUser = async (userData) => {
  try {
    const { data } = await api.post('auth/users/', userData);
    return data;
  } catch (error) {
    console.error("Error al crear el usuario:", error);
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const { data } = await api.patch(`auth/users/${userId}/`, userData);
    return data;
  } catch (error) {
    console.error("Error al actualizar el usuario:", error);
    throw error;
  }
};

export const updateProfile = async (formData) => {
  try {
    const { data } = await api.patch('auth/profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    const { data } = await api.delete(`auth/users/${userId}/`);
    return data;
  } catch (error) {
    console.error("Error al desactivar usuario:", error);
    throw error;
  }
};

export const activateUser = async (userId) => {
  try {
    const { data } = await api.patch(`auth/users/${userId}/`, { is_active: true });
    return data;
  } catch (error) {
    console.error("Error al activar usuario:", error);
    throw error;
  }
};

export const getCurrentUserFromSession = async () => {
  try {
    const { data } = await api.get('/auth/user-from-session/');
    return data;
  } catch (error) {
    console.error("Error al obtener usuario desde sesión:", error);
    throw error;
  }
};

export const getClients = async () => {
  try {
    const response = await api.get('/auth/clients/');
    return response.data;
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
};