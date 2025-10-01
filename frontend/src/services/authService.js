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



export const changePassword = async (currentPassword, newPassword, confirmPassword) => {
  try {
    const token = localStorage.getItem('access_token');
  
    const response = await fetch(`http://localhost:8000/api/v1/auth/profile/change-password/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        old_password: currentPassword,       
        new_password: newPassword,
        confirm_password: confirmPassword
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error al cambiar la contraseña');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en el servicio de cambio de contraseña:', error);
    throw error;
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