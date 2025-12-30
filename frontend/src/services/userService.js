import api from './api';

export const getUsers = async (page = 1, search = '') => {
  try {
    let url = `auth/users/?page=${page}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const { data } = await api.get(url);
    return data;
  } catch (error) {
    throw error;
  }
};

export const createUser = async (userData) => {
  try {
    const { data } = await api.post('auth/users/', userData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateUser = async (userId, userData) => {
  try {
    const { data } = await api.patch(`auth/users/${userId}/`, userData);
    return data;
  } catch (error) {
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
    throw error;
  }
};

export const deleteUser = async (userId) => {
  try {
    const { data } = await api.delete(`auth/users/${userId}/`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const activateUser = async (userId) => {
  try {
    const { data } = await api.patch(`auth/users/${userId}/`, { is_active: true });
    return data;
  } catch (error) {
    throw error;
  }
};

export const changeUserPassword = async (userId, newPassword) => {
  try {
    const { data } = await api.post(`auth/users/${userId}/change_password/`, { 
      new_password: newPassword 
    });
    return data;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUserFromSession = async () => {
  try {
    const { data } = await api.get('/auth/user-from-session/');
    return data;
  } catch (error) {
    throw error;
  }
};

export const getClients = async () => {
  try {
    const response = await api.get('/auth/clients/');
    return response.data;
  } catch (error) {
    throw error;
  }
};