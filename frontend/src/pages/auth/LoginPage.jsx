import React from 'react';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import logo from '/icons/MatrixMh.png';
import { FiLogIn, FiEye, FiEyeOff, FiMail } from 'react-icons/fi';
import Modal from '../../components/common/Modal';
import api from '../../services/api';
import './AuthPages.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [showPassword, setShowPassword] = React.useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState('');
  const [sendingRequest, setSendingRequest] = React.useState(false);

  const onSubmit = async (credentials) => {
    try {
      await login(credentials);
    } catch (error) {
      console.error("Fallo en el inicio de sesión (manejado por el contexto).");
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      toast.error('Por favor ingresa tu correo electrónico');
      return;
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      toast.error('Por favor ingresa un correo electrónico válido');
      return;
    }

    setSendingRequest(true);
    try {
      await api.post('/auth/forgot-password/', { email: forgotPasswordEmail });
      toast.success('Se ha notificado al administrador. Recibirás respuesta pronto.');
      setIsForgotPasswordOpen(false);
      setForgotPasswordEmail('');
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          error.response?.data?.error || 
                          'No se pudo enviar la solicitud. Intenta nuevamente.';
      toast.error(errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Iniciar Sesión | MH Soluciones</title>
      </Helmet>
      
      <div className="auth-container">
        {/* Animated background bars */}
        <div className="loginbackground-gridContainer">
          <div className="box-root flex-flex" style={{gridArea: '4 / 2 / auto / 5'}}>
            <div className="box-root box-divider--light-all-2 animationLeftRight tans3s" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '6 / start / auto / 2'}}>
            <div className="box-root box-background--blue800" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '7 / start / auto / 4'}}>
            <div className="box-root box-background--blue animationLeftRight" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '8 / 4 / auto / 6'}}>
            <div className="box-root box-background--gray100 animationLeftRight tans3s" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '2 / 15 / auto / end'}}>
            <div className="box-root box-background--cyan200 animationRightLeft tans4s" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '3 / 14 / auto / end'}}>
            <div className="box-root box-background--blue animationRightLeft" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '4 / 17 / auto / 20'}}>
            <div className="box-root box-background--gray100 animationRightLeft tans4s" style={{flexGrow: 1}}></div>
          </div>
          <div className="box-root flex-flex" style={{gridArea: '5 / 14 / auto / 17'}}>
            <div className="box-root box-divider--light-all-2 animationRightLeft tans3s" style={{flexGrow: 1}}></div>
          </div>
        </div>
        
        {/* Left side - Logo */}
        <div className="auth-left">
          <div className="auth-logo-large">
            <img 
              src={logo} 
              alt="MH Soluciones Empresariales" 
            />
            <p>Sistema de gestión empresarial para proyectos, tareas y recursos humanos</p>
          </div>
        </div>
        
        {/* Right side - Form */}
        <div className="auth-right">
          <div className="auth-card">
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

              {/* NUEVO: Enlace de recuperación de contraseña */}
              <div className="forgot-password-link">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>

            <div className="auth-footer">
              <p>© {new Date().getFullYear()} MH Soluciones. Todos los derechos reservados.</p>
            </div>
          </div>
        </div>
      </div>

      {/* NUEVO: Modal de recuperación de contraseña */}
      {isForgotPasswordOpen && (
        <Modal
          title="Recuperar Contraseña"
          onClose={() => {
            setIsForgotPasswordOpen(false);
            setForgotPasswordEmail('');
          }}
        >
          <form onSubmit={handleForgotPassword} className="forgot-password-form">
            <p className="forgot-password-description">
              Ingresa tu correo electrónico y notificaremos al administrador para que restablezca tu contraseña.
            </p>
            
            <div className="form-group">
              <label htmlFor="forgot-email">
                <FiMail /> Correo Electrónico
              </label>
              <input
                id="forgot-email"
                type="email"
                placeholder="ejemplo@correo.com"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                autoFocus
                disabled={sendingRequest}
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setForgotPasswordEmail('');
                }}
                disabled={sendingRequest}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sendingRequest}
              >
                {sendingRequest ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
};

export default LoginPage;
