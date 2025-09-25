import React from 'react';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/img/logo.png';
import { FiLogIn, FiEye, FiEyeOff } from 'react-icons/fi';
import './AuthPages.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [showPassword, setShowPassword] = React.useState(false);

  const onSubmit = async (credentials) => {
    try {
      await login(credentials);
    } catch (error) {
      console.error("Fallo en el inicio de sesión (manejado por el contexto).");
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión | MH Soluciones</title>
      </Helmet>
      
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-logo">
            <img 
              src={logo} 
              alt="MH Soluciones Empresariales" 
              className="logo-image"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="logo-fallback">
              <div className="logo-icon">MH</div>
            </div>
          </div>

          <div className="auth-header">
            <h2>Bienvenido de vuelta</h2>
            <p>Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Nombre de Usuario
              </label>
              <div className="input-container">
                <input
                  id="username"
                  type="text"
                  placeholder="Ingresa tu usuario"
                  className={errors.username ? 'error' : ''}
                  {...register('username', { required: 'El nombre de usuario es obligatorio' })}
                />
              </div>
              {errors.username && <span className="error-message">{errors.username.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div className="input-container password-input">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={errors.password ? 'error' : ''}
                  {...register('password', { required: 'La contraseña es obligatoria' })}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password.message}</span>}
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={isSubmitting}
            >
              <FiLogIn />
              {isSubmitting ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
              {isSubmitting && <div className="button-spinner"></div>}
            </button>
          </form>

          <div className="auth-footer">
            <p>© {new Date().getFullYear()} MH Soluciones. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;