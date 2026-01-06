import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../contexts/AuthContext';
import { verifyTwoFactor } from '../../services/authService';
import toast from 'react-hot-toast';
import { FiShield } from 'react-icons/fi';
import logo from '../../assets/img/logo.png'; 
import './AuthPages.scss';

const TwoFactorPage = () => {
  const navigate = useNavigate();
  const { finalizeLogin } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    const user_pk = sessionStorage.getItem('user_pk_2fa');
    if (!user_pk) {
      toast.error("Sesión inválida. Por favor, inicia sesión de nuevo.");
      navigate('/login');
      return;
    }

    try {
      const response = await verifyTwoFactor({ user_pk, otp_token: data.otp_token });
      
      sessionStorage.removeItem('user_pk_2fa');
      
      finalizeLogin(response.user, response.access);

    } catch (error) {
      toast.error(error.detail || error.error || 'El código de verificación es incorrecto.');
    }
  };

  return (
    <>
      <Helmet>
        <title>Verificación 2FA | MH Soluciones</title>
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
            <div className="security-icon">
              <FiShield />
            </div>
            <h2>Verificación de Dos Pasos</h2>
            <p>Ingresa el código de 6 dígitos de tu aplicación de autenticación</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
            <div className="form-group">
              <label htmlFor="otp_token" className="form-label">
                Código de Verificación
              </label>
              <div className="input-container otp-input">
                <input
                  id="otp_token"
                  type="text"
                  maxLength="6"
                  placeholder="123456"
                  className={errors.otp_token ? 'error' : ''}
                  {...register('otp_token', { 
                    required: 'El código es obligatorio',
                    minLength: { value: 6, message: 'Debe tener 6 dígitos' },
                    maxLength: { value: 6, message: 'Debe tener 6 dígitos' }
                  })}
                />
              </div>
              {errors.otp_token && <span className="error-message">{errors.otp_token.message}</span>}
            </div>

            <button 
              type="submit" 
              className="auth-button"
              disabled={isSubmitting}
            >
              <FiShield />
              {isSubmitting ? 'Verificando...' : 'Verificar Código'}
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

export default TwoFactorPage;