import api from './api';

export const login = async (credentials) => {
  try {
    const { data } = await api.post('auth/login/', credentials);
    return data;
    
  } catch (error) {
    throw error.response.data;
  }
};

export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  try {
    const response = await api.post('auth/profile/change-password/', {
      old_password: currentPassword,       
      new_password: newPassword,
      confirm_password: confirmPassword
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const setupTwoFactor = async () => {
  try {
    const { data } = await api.post('auth/2fa-setup/');
    return data;
  } catch (error) {
    throw error.response.data;
  }
};

export const verifyTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-verify/', payload);
    return data;
  } catch (error) {
    throw error.response.data;
  }
};

export const confirmTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-confirm/', payload);
    return data;
  } catch (error) {
    throw error.response.data;
  }
};