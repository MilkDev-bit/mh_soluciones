import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import { createTask } from '../../services/taskService';
import { taskSchema } from '../../schemas';

const TaskModal = ({ project, onClose, onTaskCreated }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      project: project.id,
      status: 'DRAFT',
      priority: 'MEDIUM',
    },
  });

  const onSubmit = async (data) => {
    try {
      const newTask = await createTask(data);
      toast.success('¡Tarea creada exitosamente!');
      onTaskCreated(newTask);
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
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
        toast.error('No se pudo crear la tarea.');
      }
    }
  };

  return (
    <Modal title="Crear Nueva Tarea" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="form">
        <div className="form-group">
          <label htmlFor="title">Título de la Tarea *</label>
          <input
            id="title"
            type="text"
            className={errors.title ? 'input-error' : ''}
            {...register('title')}
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
          {errors.description && <span className="error-message">{errors.description.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="priority">Prioridad</label>
          <select
            id="priority"
            {...register('priority')}
          >
            <option value="LOW">Baja</option>
            <option value="MEDIUM">Media</option>
            <option value="HIGH">Alta</option>
          </select>
          {errors.priority && <span className="error-message">{errors.priority.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="due_date">Fecha de Vencimiento</label>
          <input
            id="due_date"
            type="date"
            className={errors.due_date ? 'input-error' : ''}
            {...register('due_date')}
          />
          {errors.due_date && <span className="error-message">{errors.due_date.message}</span>}
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