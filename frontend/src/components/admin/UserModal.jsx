import React from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import './UserModal.scss';
import { createUser, updateUser } from '../../services/userService';
import '../../assets/styles/_buttons.scss';

const UserModal = ({ userToEdit, onClose, onUserSaved }) => {
  const isEditMode = Boolean(userToEdit);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: isEditMode ? {
      username: userToEdit.username,
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      email: userToEdit.email,
      role: userToEdit.role,
    } : {},
  });

  const onSubmit = async (data) => {
    try {
      let savedUser;
      if (isEditMode) {
        const changedData = Object.keys(data).reduce((acc, key) => {
          if (data[key] !== userToEdit[key]) {
            acc[key] = data[key];
          }
          return acc;
        }, {});
        if (Object.keys(changedData).length > 0) {
          savedUser = await updateUser(userToEdit.id, changedData);
        } else {
          savedUser = userToEdit;
        }
        toast.success('¡Usuario actualizado exitosamente!');
      } else {
        savedUser = await createUser(data);
        toast.success('¡Usuario creado exitosamente!');
      }
      onUserSaved(savedUser, isEditMode);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.username?.[0] || 'No se pudo guardar el usuario.');
    }
  };

  return (
    <Modal title={isEditMode ? 'Editar Usuario' : 'Crear Nuevo Usuario'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        <div className="form-group">
          <label className="form-label" htmlFor="username">Nombre de Usuario</label>
          <input className="form-input" id="username" type="text" {...register('username', { required: 'El nombre de usuario es obligatorio' })} />
          {errors.username && <span className="error-message">{errors.username.message}</span>}
        </div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="first_name">Nombre</label>
          <input className="form-input" id="first_name" type="text" {...register('first_name', { required: 'El nombre es obligatorio' })} />
          {errors.first_name && <span className="error-message">{errors.first_name.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="last_name">Apellidos</label>
          <input className="form-input" id="last_name" type="text" {...register('last_name', { required: 'El apellido es obligatorio' })} />
          {errors.last_name && <span className="error-message">{errors.last_name.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input className="form-input" id="email" type="email" {...register('email', { required: 'El email es obligatorio' })} />
          {errors.email && <span className="error-message">{errors.email.message}</span>}
        </div>
        
        {!isEditMode && (
          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input className="form-input" id="password" type="password" {...register('password', { required: 'La contraseña es obligatoria' })} />
            {errors.password && <span className="error-message">{errors.password.message}</span>}
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="role">Rol</label>
          <select className="form-select" id="role" {...register('role', { required: 'El rol es obligatorio' })}>
            <option value="STUDENT">Alumno / Empleado</option>
            <option value="PROFESSOR">Profesor</option>
            <option value="DIRECTOR">Director</option>
            <option value="ADMIN">Administrador</option>
            <option value="SUPERADMIN">Super Administrador</option>
            <option value="CLIENT">Cliente</option>
            <option value="CEO">CEO</option>
            <option value="RH">Recursos Humanos</option>
          </select>
          {errors.role && <span className="error-message">{errors.role.message}</span>}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Usuario')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default UserModal;