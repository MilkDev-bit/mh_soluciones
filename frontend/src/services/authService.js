import api from './api';

export const login = async (credentials) => {
  try {
    const { data } = await api.post('auth/login/', credentials);
    return data;
  } catch (error) {
    console.error("Error en el servicio de login:", error.response?.data);
    throw error.response?.data || error;
  }
};

export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  try {
    const { data } = await api.post('auth/profile/change-password/', {
      old_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    return data;
  } catch (error) {
    console.error('Error en el servicio de cambio de contraseña:', error);
    throw error.response?.data || new Error('Error al cambiar la contraseña');
  }
};

export const setupTwoFactor = async () => {
  try {
    const { data } = await api.post('auth/2fa-setup/');
    return data;
  } catch (error) {
    console.error("Error al configurar 2FA:", error.response?.data);
    throw error.response?.data || error;
  }
};

export const verifyTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-verify/', payload);
    return data;
  } catch (error) {
    console.error("Error en el servicio de verificación 2FA:", error.response?.data);
    throw error.response?.data || error;
  }
};

export const confirmTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-confirm/', payload);
    return data;
  } catch (error) {
    console.error("Error al confirmar 2FA:", error.response?.data);
    throw error.response?.data || error;
  }
};

export const getLoginActivity = async (page = 1) => {
  try {
    const response = await api.get(`/auth/login-activity/?page=${page}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener la actividad de inicio de sesión:', error);
    throw error;
  }
};