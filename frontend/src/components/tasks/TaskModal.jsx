import React from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { createTask } from '../../services/taskService';

const TaskModal = ({ project, onClose, onTaskCreated }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async (data) => {
    try {
      const taskData = {
        ...data,
        project: project.id,
      };
      const newTask = await createTask(taskData);
      toast.success('¡Tarea creada exitosamente!');
      onTaskCreated(newTask);
      onClose();
    } catch (error) {
      toast.error('No se pudo crear la tarea.');
    }
  };

  return (
    <Modal title="Crear Nueva Tarea" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        <div className="form-group">
          <label htmlFor="title">Título de la Tarea</label>
          <input
            id="title"
            type="text"
            {...register('title', { required: 'El título es obligatorio' })}
          />
          {errors.title && <span className="error-message">{errors.title.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Descripción</label>
          <textarea
            id="description"
            rows="4"
            {...register('description')}
          />
        </div>

        <div className="form-group">
          <label htmlFor="due_date">Fecha de Vencimiento</label>
          <input
            id="due_date"
            type="date"
            {...register('due_date')}
          />
        </div>
        
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creando...' : 'Crear Tarea'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TaskModal;