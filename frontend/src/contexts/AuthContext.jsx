import { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { setToken, getToken, removeToken } from '../utils/token';
import Loading from '../components/common/Loading';
import { jwtDecode } from 'jwt-decode';
import notificationService from '../services/NotificationService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const logout = useCallback(() => {
    setLoading(true);
    // Disconnect notification service before logout
    notificationService.disconnect();
    removeToken();
    setUser(null);
    navigate('/login', { replace: true });
    toast.success('Sesión cerrada correctamente.');
    setLoading(false);
  }, [navigate]);

  const fetchProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const decodedToken = jwtDecode(token);
      if (decodedToken.exp * 1000 < Date.now()) {
        toast.error('Tu sesión ha expirado.');
        logout();
        return;
      }
      
      const { data } = await api.get('auth/profile/');
      setUser(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Fetch profile only once on mount to avoid infinite loops
  // Use refreshProfile() for manual updates after this initial fetch
  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - fetchProfile excluded to prevent re-runs

  // Manual refetch function for when needed
  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  // Connect auth error handler to logout
  useEffect(() => {
    if (user) {
      notificationService.setAuthErrorHandler(() => {
        // Perform logout when there is an authentication error
        logout();
      });
    }
    return () => {
      // Clean up handler when component unmounts or user changes
      if (!user) {
        notificationService.setAuthErrorHandler(null);
      }
    };
  }, [user, logout]);

  const login = async (credentials) => {
    try {
      const { data } = await api.post('auth/login/', credentials);

      if (data.requires_2fa) {
        sessionStorage.setItem('user_pk_2fa', data.user_pk);
        navigate('/verify-2fa');
      } else {
        finalizeLogin(data.user, data.access);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Usuario o contraseña incorrectos.');
      throw error;
    }
  };

  const finalizeLogin = (userData, accessToken) => {
    setToken(accessToken);
    setUser(userData);
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
    toast.success(`¡Bienvenido de nuevo, ${userData.first_name || userData.username}!`);
  };

  const updateUserContext = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  };

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

export const useAuth = () => {
  return useContext(AuthContext);
};