import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { changeUserPassword } from '../../services/userService';
import '../../assets/styles/_buttons.scss';
import './UserModal.scss';

const ChangePasswordModal = ({ user, onClose, onPasswordChanged }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    try {
      setIsSubmitting(true);
      await changeUserPassword(user.id, newPassword);
      toast.success('Contraseña actualizada correctamente.');
      onPasswordChanged();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Cambiar Contraseña - ${user.first_name} ${user.last_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label className="form-label" htmlFor="newPassword">Nueva Contraseña</label>
          <input
            className="form-input"
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="confirmPassword">Confirmar Contraseña</label>
          <input
            className="form-input"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Repite la contraseña"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Cambiando...' : 'Cambiar Contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
