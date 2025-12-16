import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import './UserModal.scss';
import { createUser, updateUser } from '../../services/userService';
import { userSchema, userUpdateSchema } from '../../schemas';
import '../../assets/styles/_buttons.scss';

const UserModal = ({ userToEdit, onClose, onUserSaved }) => {
  const isEditMode = Boolean(userToEdit);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(isEditMode ? userUpdateSchema : userSchema),
    defaultValues: isEditMode ? {
      username: userToEdit.username,
      first_name: userToEdit.first_name,
      last_name: userToEdit.last_name,
      email: userToEdit.email,
      role: userToEdit.role,
    } : {
      role: 'STUDENT',
    },
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
      console.error('Error saving user:', error);
      if (error.response?.data) {
        // Show backend validation errors
        const backendErrors = error.response.data;
        Object.keys(backendErrors).forEach(key => {
          if (Array.isArray(backendErrors[key])) {
            toast.error(`${key}: ${backendErrors[key].join(', ')}`);
          } else {
            toast.error(`${key}: ${backendErrors[key]}`);
          }
        });
      } else {
        toast.error('No se pudo guardar el usuario.');
      }
    }
  };

  return (
    <Modal title={isEditMode ? 'Editar Usuario' : 'Crear Nuevo Usuario'} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        <div className="form-group">
          <label className="form-label" htmlFor="username">Nombre de Usuario *</label>
          <input 
            className={`form-input ${errors.username ? 'input-error' : ''}`} 
            id="username" 
            type="text" 
            {...register('username')} 
          />
          {errors.username && <span className="error-message">{errors.username.message}</span>}
        </div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="first_name">Nombre *</label>
          <input 
            className={`form-input ${errors.first_name ? 'input-error' : ''}`} 
            id="first_name" 
            type="text" 
            {...register('first_name')} 
          />
          {errors.first_name && <span className="error-message">{errors.first_name.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="last_name">Apellidos *</label>
          <input 
            className={`form-input ${errors.last_name ? 'input-error' : ''}`} 
            id="last_name" 
            type="text" 
            {...register('last_name')} 
          />
          {errors.last_name && <span className="error-message">{errors.last_name.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email *</label>
          <input 
            className={`form-input ${errors.email ? 'input-error' : ''}`} 
            id="email" 
            type="email" 
            {...register('email')} 
          />
          {errors.email && <span className="error-message">{errors.email.message}</span>}
        </div>
        
        {!isEditMode && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Contraseña *</label>
              <input 
                className={`form-input ${errors.password ? 'input-error' : ''}`} 
                id="password" 
                type="password" 
                {...register('password')} 
              />
              {errors.password && <span className="error-message">{errors.password.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password_confirm">Confirmar Contraseña *</label>
              <input 
                className={`form-input ${errors.password_confirm ? 'input-error' : ''}`} 
                id="password_confirm" 
                type="password" 
                {...register('password_confirm')} 
              />
              {errors.password_confirm && <span className="error-message">{errors.password_confirm.message}</span>}
            </div>
          </>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="role">Rol *</label>
          <select 
            className={`form-select ${errors.role ? 'input-error' : ''}`} 
            id="role" 
            {...register('role')}
          >
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
