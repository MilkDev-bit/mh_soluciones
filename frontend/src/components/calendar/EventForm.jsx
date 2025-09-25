import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createEvent, updateEvent } from '../../services/calendarService';

const eventTypeOptions = [
  { value: 'MEETING', label: 'Reunión' },
  { value: 'DEADLINE', label: 'Fecha Límite' },
  { value: 'APPOINTMENT', label: 'Cita' },
  { value: 'OTHER', label: 'Otro' },
];

const EventForm = ({ event, project, onEventSaved, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm();
  const isEditMode = Boolean(event);

  useEffect(() => {
    if (isEditMode) {
      setValue('title', event.title);
      setValue('description', event.description);
      setValue('start_time', event.start_time.slice(0, 16));
      setValue('end_time', event.end_time.slice(0, 16));
      setValue('event_type', event.event_type);
    }
  }, [event, isEditMode, setValue]);

  const onSubmit = async (data) => {
    try {
      const eventData = { ...data, project: project.id };
      let savedEvent;
      if (isEditMode) {
        savedEvent = await updateEvent(event.id, eventData);
      } else {
        savedEvent = await createEvent(eventData);
      }
      onEventSaved(savedEvent, isEditMode);
    } catch (error) {
      toast.error('No se pudo guardar el evento.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <div className="form-grid">
        <div className="form-group full-width">
          <label className="form-label" htmlFor="title">Título del Evento</label>
          <input
            id="title"
            type="text"
            className="form-input"
            {...register('title', { required: 'El título es obligatorio' })}
          />
          {errors.title && <span className="error-message">{errors.title.message}</span>}
        </div>

        <div className="form-group full-width">
          <label className="form-label" htmlFor="event_type">Tipo de Evento</label>
          <select
            id="event_type"
            className="form-input"
            {...register('event_type', { required: 'El tipo de evento es obligatorio' })}
          >
            {eventTypeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.event_type && <span className="error-message">{errors.event_type.message}</span>}
        </div>
        
        <div className="form-group">
          <label className="form-label" htmlFor="start_time">Inicio</label>
          <input 
            id="start_time" 
            type="datetime-local" 
            className="form-input" 
            {...register('start_time', { required: 'La fecha de inicio es obligatoria' })} 
          />
          {errors.start_time && <span className="error-message">{errors.start_time.message}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="end_time">Fin</label>
          <input 
            id="end_time" 
            type="datetime-local" 
            className="form-input" 
            {...register('end_time', { required: 'La fecha de fin es obligatoria' })} 
          />
           {errors.end_time && <span className="error-message">{errors.end_time.message}</span>}
        </div>

        <div className="form-group full-width">
          <label className="form-label" htmlFor="description">Descripción</label>
          <textarea
            id="description"
            className="form-input"
            rows="3"
            {...register('description')}
          ></textarea>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Evento')}
        </button>
      </div>
    </form>
  );
};

export default EventForm;