import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createProject, updateProject } from '../../services/projectService';
import { getClients } from '../../services/userService'
import '../../assets/styles/_buttons.scss';

const ProjectForm = ({ project, onProjectSaved, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm();
  const [clients, setClients] = useState([]);
  const isEditMode = Boolean(project);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await getClients();
        setClients(response.results || response || []);
      } catch (error) {
        toast.error("No se pudo cargar la lista de clientes.");
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    if (isEditMode && project) {
      setValue('name', project.name);
      setValue('description', project.description);
      setValue('start_date', project.start_date);
      setValue('end_date', project.end_date);
      setValue('status', project.status);
      setValue('client', project.client?.id || project.client);
    }
  }, [project, isEditMode, setValue]);

  const onSubmit = async (data) => {
    const payload = { ...data };
    
    if (!payload.start_date) delete payload.start_date;
    if (!payload.end_date) delete payload.end_date;

    try {
      let savedProject;
      if (isEditMode) {
        savedProject = await updateProject(project.id, payload);
      } else {
        savedProject = await createProject(payload);
      }
      onProjectSaved(savedProject, isEditMode);
    } catch (error) {
      const errorMessage = error.response?.data?.client?.[0] || 'No se pudo guardar el proyecto.';
      toast.error(errorMessage);
      console.error("Error al guardar:", error.response?.data || error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <div className="form-group">
        <label htmlFor="name" className="form-label">Nombre del Proyecto</label>
        <input 
          id="name" 
          type="text" 
          className="form-input"
          {...register('name', { required: 'El nombre es obligatorio' })} 
        />
        {errors.name && <span className="error-message">{errors.name.message}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="description" className="form-label">Descripción</label>
        <textarea 
          id="description" 
          className="form-input"
          rows="3"
          {...register('description')}
        ></textarea>
      </div>
      
      <div className="form-group">
        <label htmlFor="client" className="form-label">Cliente</label>
        <select 
          id="client" 
          className="form-select" 
          {...register('client', { required: 'El cliente es obligatorio' })}
        >
          <option value="">-- Selecciona un cliente --</option>
          {clients.map(clientUser => (
            <option key={clientUser.id} value={clientUser.id}>
              {clientUser.first_name} {clientUser.last_name} ({clientUser.email})
            </option>
          ))}
        </select>
        {errors.client && <span className="error-message">{errors.client.message}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label htmlFor="start_date" className="form-label">Fecha de Inicio</label>
          <input id="start_date" type="date" className="form-input" {...register('start_date')} />
        </div>
        <div className="form-group">
          <label htmlFor="end_date" className="form-label">Fecha de Fin</label>
          <input id="end_date" type="date" className="form-input" {...register('end_date')} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="status" className="form-label">Estado</label>
        <select id="status" className="form-select" {...register('status')}>
          <option value="PLANNING">Planificación</option>
          <option value="IN_PROGRESS">En Progreso</option>
          <option value="COMPLETED">Completado</option>
          <option value="ON_HOLD">En Espera</option>
        </select>
      </div>

      <div className="form-actions" style={{ justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #e5e5e5', marginTop: '1rem' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar Proyecto'}
        </button>
      </div>
    </form>
  );
};

export default ProjectForm;