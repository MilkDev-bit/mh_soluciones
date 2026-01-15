import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../contexts/AuthContext';
import { verifyTwoFactor } from '../../services/authService';
import toast from 'react-hot-toast';
import { FiShield } from 'react-icons/fi';
 
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
              src="/icons/MatrixMh.png" 
              alt="MH Soluciones Empresariales" 
            />
            <h1>MH Soluciones</h1>
            <p>Sistema de gestión empresarial para proyectos, tareas y recursos humanos</p>
          </div>
        </div>
        
        {/* Right side - Form */}
        <div className="auth-right">
          <div className="auth-card">
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
      </div>
    </>
  );
};

export default TwoFactorPage;