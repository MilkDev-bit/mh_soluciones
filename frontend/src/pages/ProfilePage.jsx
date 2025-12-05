import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { changePassword, setupTwoFactor, confirmTwoFactor } from '../services/authService';
import { updateProfile } from '../services/userService';
import { FiUser, FiShield, FiKey, FiCamera, FiCheck, FiEdit2, FiGrid } from 'react-icons/fi';
import GoogleDriveConnect from '../components/auth/GoogleDriveConnect';
import { QRCodeCanvas } from 'qrcode.react';
import Modal from '../components/common/Modal';
import './ProfilePage.scss';
import api from '../services/api';

const ProfilePage = () => {
  const { user, updateUserContext } = useAuth();
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [qrCodeUri, setQrCodeUri] = useState('');
  const [devicePk, setDevicePk] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const {
    register: pwdRegister,
    handleSubmit: pwdHandleSubmit,
    formState: { errors: pwdErrors, isSubmitting: isPwdSubmitting },
    reset: pwdReset,
  } = useForm();

  const {
    register: profileRegister,
    handleSubmit: profileHandleSubmit,
    formState: { errors: profileErrors, isSubmitting: isProfileSubmitting },
    reset: profileReset
  } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || ''
    }
  });

  useEffect(() => {
    if (user) {
      profileReset({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email
      });
    }
  }, [user, profileReset]);

  useEffect(() => {
    if (isPwdModalOpen || is2FAModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [isPwdModalOpen, is2FAModalOpen]);

  const onPasswordSubmit = async (data) => {
    if (data.new_password !== data.confirm_password) {
      toast.error("Las nuevas contraseñas no coinciden.");
      return;
    }
    try {
      await changePassword(
        data.old_password,
        data.new_password,
        data.confirm_password
      );
      toast.success("¡Contraseña actualizada exitosamente!");
      setIsPwdModalOpen(false);
      pwdReset();
    } catch (error) {
      const errorData = await error.json();
      const errorDetail = errorData.old_password || errorData.new_password || errorData.confirm_password || "No se pudo cambiar la contraseña.";
      toast.error(errorDetail[0] || errorDetail);
    }
  };

  const onProfileSubmit = async (data) => {
    try {
      const updatedUser = await updateProfile(data);
      updateUserContext(updatedUser);
      toast.success("¡Perfil actualizado exitosamente!");
      setIsEditing(false);
    } catch (error) {
      toast.error(error.detail || error.error || "No se pudo actualizar el perfil.");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };


  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match('image/jpeg|image/png')) {
      toast.error('Por favor, selecciona una imagen JPEG o PNG');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 2MB');
      return;
    }

    const formData = new FormData();
    formData.append('profile_picture', file);

    const toastId = toast.loading('Subiendo imagen...');
    try {
      await updateProfile(formData);

      const { data: refreshedUser } = await api.get('auth/profile/');

      console.log('Usuario refrescado después de la actualización:', refreshedUser);

      updateUserContext(refreshedUser);

      toast.success('¡Foto de perfil actualizada!', { id: toastId });
      
    } catch (error) {
      console.error("Error al actualizar la foto de perfil:", error);
      toast.error('No se pudo subir la imagen.', { id: toastId });
    }
  };

  const handleOpen2FAModal = async () => {
    try {
      const toastId = toast.loading('Generando código QR...');
      const data = await setupTwoFactor();
      
      console.log('Respuesta de la API para configurar 2FA:', data);

      if (data && data.provisioning_uri) {
        setQrCodeUri(data.provisioning_uri);
        setDevicePk(data.device_pk);
        setIs2FAModalOpen(true);
        toast.dismiss(toastId);
      } else {
        toast.error('No se recibió la información para el código QR.', { id: toastId });
      }
    } catch (error) {
      toast.error('No se pudo iniciar la configuración de 2FA.');
    }
  };

  const handleConfirm2FA = async (event) => {
    event.preventDefault();
    const token = event.target.elements.otp_token.value;

    const payload = { device_pk: devicePk, otp_token: token };

    try {
      await confirmTwoFactor(payload);
      toast.success('¡2FA activado exitosamente!');
      setIs2FAModalOpen(false);
      setQrCodeUri('');
      setDevicePk(null);
      const refreshedUser = { ...user, requires_2fa: true };
      updateUserContext(refreshedUser);
    } catch (error) {
      toast.error(error.error || 'El código es inválido o la sesión expiró.');
    }
  };

  const handleConnectClick = async () => {
    setIsRedirecting(true);
    try {
        const response = await api.get('/auth/google/auth/');
        const { authorization_url } = response.data;
        
        if (authorization_url) {
            window.location.href = authorization_url;
        }
    } catch (error) {
        toast.error("No se pudo iniciar la conexión con Google.");
        console.error("Error al obtener la URL de autorización:", error);
        setIsRedirecting(false);
    }
  };

  const avatarUrl = user?.profile_picture || `https://ui-avatars.com/api/?name=${user?.first_name}+${user?.last_name}&background=4f46e5&color=fff&size=128&bold=true`;

  if (!user) {
    return <div>Cargando...</div>;
  }

  return (
    <>
      <Helmet><title>Mi Perfil | MH Soluciones</title></Helmet>

      {isPwdModalOpen && (
        <Modal title="Cambiar Contraseña" onClose={() => setIsPwdModalOpen(false)}>
          <form onSubmit={pwdHandleSubmit(onPasswordSubmit)} className="modal-form">
            <div className="form-group">
                <label>Contraseña Actual</label>
                <input type="password" {...pwdRegister('old_password', { required: 'Este campo es obligatorio' })} />
                {pwdErrors.old_password && <span className="error-message">{pwdErrors.old_password.message}</span>}
            </div>
            <div className="form-group">
                <label>Nueva Contraseña</label>
                <input type="password" {...pwdRegister('new_password', { required: 'Este campo es obligatorio', minLength: { value: 8, message: 'Mínimo 8 caracteres' } })} />
                {pwdErrors.new_password && <span className="error-message">{pwdErrors.new_password.message}</span>}
            </div>
            <div className="form-group">
                <label>Confirmar Nueva Contraseña</label>
                <input type="password" {...pwdRegister('confirm_password', { required: 'Este campo es obligatorio' })} />
                {pwdErrors.confirm_password && <span className="error-message">{pwdErrors.confirm_password.message}</span>}
            </div>
            <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPwdModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isPwdSubmitting}>
                    {isPwdSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
            </div>
          </form>
        </Modal>
      )}

      {is2FAModalOpen && (
        <Modal title="Activar Autenticación de Dos Factores" onClose={() => setIs2FAModalOpen(false)}>
            <div className="two-factor-modal-content">
                <p>Escanea este código QR con tu aplicación de autenticación (ej. Google Authenticator).</p>
                <div className="qr-code-container">
                    {qrCodeUri ? <QRCodeCanvas value={qrCodeUri} size={200} /> : <p>Generando código...</p>}
                </div>
                <p>Luego, ingresa el código de 6 dígitos que aparece en la aplicación para confirmar.</p>
                <form onSubmit={handleConfirm2FA} className="modal-form">
                    <div className="form-group">
                        <label>Código de Verificación</label>
                        <input type="text" name="otp_token" maxLength="6" placeholder="123456" className="otp-input" required />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIs2FAModalOpen(false)}>Cancelar</button>
                        <button type="submit" className="btn btn-primary">Confirmar y Activar</button>
                    </div>
                </form>
            </div>
        </Modal>
      )}

      <div className="profile-page">
        <div className="profile-container">
          <div className="profile-sidebar">
            <div className="profile-card">
              <div className="profile-header">
                <div className="avatar-container">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="profile-avatar"
                  />
                  <button className="avatar-edit-btn" onClick={handleAvatarClick}>
                    <FiCamera />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                    accept="image/png, image/jpeg"
                  />
                </div>
                <h2 className="profile-name">{user.first_name} {user.last_name}</h2>
                <div className="profile-role">{user.role?.replace('_', ' ')}</div>
              </div>

              <nav className="profile-nav">
                <button
                  className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <FiUser /> Información Personal
                </button>
                <button
                  className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  <FiShield /> Seguridad
                </button>
                 <button
                  className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`}
                  onClick={() => setActiveTab('integrations')}
                >
                  <FiGrid /> Integraciones
                </button>
              </nav>
            </div>
          </div>

          <div className="profile-content">
            <div className="content-card">
              {activeTab === 'profile' ? (
                <>
                  <div className="card-header">
                    <h3>Información Personal</h3>
                    {!isEditing && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <FiEdit2 /> Editar
                      </button>
                    )}
                  </div>

                  <form onSubmit={profileHandleSubmit(onProfileSubmit)}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Nombre</label>
                        <input
                          type="text"
                          {...profileRegister('first_name', { required: 'El nombre es obligatorio' })}
                          disabled={!isEditing}
                          className={!isEditing ? 'disabled' : ''}
                        />
                        {profileErrors.first_name && <span className="error-message">{profileErrors.first_name.message}</span>}
                      </div>

                      <div className="form-group">
                        <label>Apellido</label>
                        <input
                          type="text"
                          {...profileRegister('last_name', { required: 'El apellido es obligatorio' })}
                          disabled={!isEditing}
                          className={!isEditing ? 'disabled' : ''}
                        />
                        {profileErrors.last_name && <span className="error-message">{profileErrors.last_name.message}</span>}
                      </div>

                      <div className="form-group full-width">
                        <label>Correo Electrónico</label>
                        <input
                          type="email"
                          {...profileRegister('email', {
                            required: 'El email es obligatorio',
                            pattern: {
                              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                              message: "Email inválido"
                            }
                          })}
                          disabled={!isEditing}
                          className={!isEditing ? 'disabled' : ''}
                        />
                        {profileErrors.email && <span className="error-message">{profileErrors.email.message}</span>}
                      </div>

                      <div className="form-group full-width">
                        <label>Nombre de Usuario</label>
                        <input
                          type="text"
                          value={user.username}
                          disabled
                          className="disabled"
                        />
                      </div>
                    </div>

                    {isEditing && (
                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setIsEditing(false);
                            profileReset({ first_name: user.first_name, last_name: user.last_name, email: user.email });
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={isProfileSubmitting}
                        >
                          {isProfileSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                      </div>
                    )}
                  </form>
                </>
              ) : activeTab === 'security' ? (
                <>
                  <div className="card-header">
                    <h3>Seguridad de la Cuenta</h3>
                  </div>

                  <div className="security-content">
                    
                    {user && !['STUDENT', 'PROFESSOR', 'DIRECTOR', 'RH'].includes(user.role) && (
                      <div className="security-item">
                        <div className="security-info">
                          <FiKey className="security-icon" />
                          <div>
                            <h4>Contraseña</h4>
                            <p>Actualiza tu contraseña regularmente para mantener tu cuenta segura</p>
                          </div>
                        </div>
                        <button
                          className="btn btn-outline"
                          onClick={() => setIsPwdModalOpen(true)}
                        >
                          Cambiar
                        </button>
                      </div>
                    )}

                    <div className="security-item">
                      <div className="security-info">
                        <FiShield className="security-icon" />
                        <div>
                          <h4>Autenticación de Dos Factores</h4>
                          <p>Protege tu cuenta con un código de verificación adicional</p>
                        </div>
                      </div>
                      {user.requires_2fa ? (
                        <div className="status-badge active">
                          <FiCheck /> Activado
                        </div>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={handleOpen2FAModal}
                        >
                          Activar
                        </button>
                      )}
                    </div>

                    <div className="security-tips">
                      <h4>Consejos de Seguridad</h4>
                      <ul>
                        <li>Usa una contraseña única y compleja</li>
                        <li>No compartas tus credenciales con nadie</li>
                        <li>Habilita la autenticación de dos factores</li>
                        <li>Cierra sesión cuando uses dispositivos compartidos</li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                    <div className="card-header">
                        <h3>Integraciones de Servicios</h3>
                    </div>
                    <div className="integrations-content">
                        <GoogleDriveConnect />
                    </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;