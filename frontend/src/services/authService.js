import api from './api';

export const login = async (credentials) => {
  try {
    const { data } = await api.post('auth/login/', credentials);
    return data;
    
  } catch (error) {
    console.error("Error en el servicio de login:", error.response.data);
    throw error.response.data;
  }
};

export const changePassword = async (passwords) => {
  try {
    const { data } = await api.post('auth/change-password/', passwords);
    return data;
  } catch (error) {
    console.error("Error en el servicio de cambio de contraseña:", error.response.data);
    throw error.response.data;
  }
};

export const setupTwoFactor = async () => {
  try {
    const { data } = await api.post('auth/2fa-setup/');
    return data;
  } catch (error) {
    console.error("Error al configurar 2FA:", error.response.data);
    throw error.response.data;
  }
};

export const verifyTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-verify/', payload);
    return data;
  } catch (error) {
    console.error("Error en el servicio de verificación 2FA:", error.response.data);
    throw error.response.data;
  }
};

export const confirmTwoFactor = async (payload) => {
  try {
    const { data } = await api.post('auth/2fa-confirm/', payload);
    return data;
  } catch (error) {
    console.error("Error al confirmar 2FA:", error.response.data);
    throw error.response.data;
  }
};