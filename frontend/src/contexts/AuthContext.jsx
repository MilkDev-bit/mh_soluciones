import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import Loading from '../components/common/Loading';
import notificationService from '../services/NotificationService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const fetchProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('auth/profile/');
      setUser(data);
    } catch (error) {
      setUser(null);
      if (!silent && location.pathname !== '/login') {
        console.log("Sesión no activa o expirada");
      }
    } finally {
      setLoading(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('auth/logout/');
    } catch (error) {
      console.error("Error en logout:", error);
    } finally {
      notificationService.disconnect();
      setUser(null);
      setLoading(false);
      navigate('/login', { replace: true });
      toast.success('Sesión cerrada correctamente.');
    }
  }, [navigate]);

  const login = async (credentials) => {
    try {
      const { data } = await api.post('auth/login/', credentials);

      if (data.requires_2fa) {
        sessionStorage.setItem('user_pk_2fa', data.user_pk);
        navigate('/verify-2fa');
      } else {
        finalizeLogin(data.user);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Usuario o contraseña incorrectos.';
      toast.error(errorMsg);
      throw error;
    }
  };

  const finalizeLogin = (userData) => {
    setUser(userData);
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
    toast.success(`¡Bienvenido de nuevo, ${userData.first_name || userData.username}!`);
  };

  const updateUserContext = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  };

  const refreshProfile = useCallback(async () => {
    await fetchProfile(true);
  }, [fetchProfile]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchProfile]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchProfile(true);
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (user) {
      notificationService.setAuthErrorHandler(() => logout());
    }
    return () => notificationService.setAuthErrorHandler(null);
  }, [user, logout]);

  const value = {
    user,
    loading,
    login,
    logout,
    updateUserContext,
    finalizeLogin,
    refreshProfile,
  };

  if (loading) {
    return <Loading fullscreen />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);