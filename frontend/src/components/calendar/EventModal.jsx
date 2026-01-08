import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { createEvent, updateEvent, deleteEvent } from '../../services/calendarService';
import { FiX, FiTrash2, FiCalendar, FiClock, FiEdit2, FiPlus } from 'react-icons/fi';
import './EventModal.scss';

const eventColorOptions = [
  { value: '#2C74B3', label: 'Azul (Información)' },
  { value: '#198754', label: 'Verde (Hito)' },
  { value: '#ffc107', label: 'Amarillo (Advertencia)' },
  { value: '#dc3545', label: 'Rojo (Urgente)' },
  { value: '#6f42c1', label: 'Púrpura (Reunión)' },
  { value: '#fd7e14', label: 'Naranja (Recordatorio)' },
];

const formatDateForInput = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    return localISOTime;
  } catch (e) {
    return '';
  }
};

const EventModal = ({ isOpen, onClose, event, projectId, onEventSaved }) => {
  const isEditMode = Boolean(event?.id);
  const [selectedColor, setSelectedColor] = useState(event?.color || '#2C74B3');

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, reset, watch } = useForm({
    defaultValues: {
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      color: event?.color || '#2C74B3',
    }
  });

  const colorValue = watch('color', event?.color || '#2C74B3');

  useEffect(() => {
    if (colorValue) {
      setSelectedColor(colorValue);
    }
  }, [colorValue]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setValue('title', event.title || '');
        setValue('description', event.description || '');
        setValue('start_time', formatDateForInput(event.start));
        setValue('end_time', formatDateForInput(event.end));
        setValue('color', event.color || '#2C74B3');
        setSelectedColor(event.color || '#2C74B3');
      } else {
        reset();
        const now = new Date();
        const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
        const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);
        
        setValue('start_time', formatDateForInput(defaultStart));
        setValue('end_time', formatDateForInput(defaultEnd));
        setValue('color', '#2C74B3');
        setSelectedColor('#2C74B3');
      }
    }
  }, [isOpen, event, isEditMode, setValue, reset]);

  const onSubmit = async (formData) => {
    const eventData = { 
      ...formData, 
      project: projectId,
      start_time: new Date(formData.start_time).toISOString(),
      end_time: new Date(formData.end_time).toISOString()
    };
    
    try {
      if (isEditMode) {
        await updateEvent(event.id, eventData);
        toast.success('Evento actualizado correctamente.');
      } else {
        await createEvent(eventData);
        toast.success('Evento creado correctamente.');
      }
      onEventSaved();
      onClose();
    } catch (error) {
      toast.error('No se pudo guardar el evento.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      try {
        await deleteEvent(event.id);
        toast.success('Evento eliminado correctamente.');
        onEventSaved();
        onClose();
      } catch (error) {
        toast.error('No se pudo eliminar el evento.');
      }
    }
  };

  const handleOverlayClick = useCallback((e) => {
    // Only close if the click was directly on the overlay, not on child elements
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="event-modal-overlay" onClick={handleOverlayClick}>
      <div className="event-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="event-modal-header">
          <div className="event-modal-title">
            {isEditMode ? (
              <>
                <FiEdit2 />
                <h2>Editar Evento</h2>
              </>
            ) : (
              <>
                <FiPlus />
                <h2>Crear Nuevo Evento</h2>
              </>
            )}
          </div>
          <button className="event-modal-close" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="event-form">
          <div className="event-form-grid">
            <div className="form-group full-width">
              <label htmlFor="title" className="form-label">
                Título del Evento *
              </label>
              <input
                id="title"
                type="text"
                className={`form-input ${errors.title ? 'error' : ''}`}
                placeholder="Ingresa el título del evento"
                {...register('title', { required: 'El título es obligatorio' })}
              />
              {errors.title && <span className="error-message">{errors.title.message}</span>}
            </div>

            <div className="form-group full-width">
              <label htmlFor="color" className="form-label">
                Color del Evento *
              </label>
              <div className="color-select-wrapper">
                <select
                  id="color"
                  className={`form-input color-select ${errors.color ? 'error' : ''}`}
                  style={{ 
                    borderLeft: `4px solid ${selectedColor}`,
                    backgroundImage: `linear-gradient(45deg, ${selectedColor}20, ${selectedColor}20)`
                  }}
                  {...register('color', { required: 'El color es obligatorio' })}
                >
                  {eventColorOptions.map(option => (
                    <option 
                      key={option.value} 
                      value={option.value}
                      style={{ backgroundColor: `${option.value}20` }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <div 
                  className="color-preview" 
                  style={{ backgroundColor: selectedColor }}
                  title={`Color seleccionado: ${selectedColor}`}
                ></div>
              </div>
              {errors.color && <span className="error-message">{errors.color.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="start_time" className="form-label">
                <FiCalendar />
                Fecha de Inicio *
              </label>
              <input
                id="start_time"
                type="datetime-local"
                className={`form-input ${errors.start_time ? 'error' : ''}`}
                {...register('start_time', { required: 'La fecha de inicio es obligatoria' })}
              />
              {errors.start_time && <span className="error-message">{errors.start_time.message}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="end_time" className="form-label">
                <FiClock />
                Fecha de Fin *
              </label>
              <input
                id="end_time"
                type="datetime-local"
                className={`form-input ${errors.end_time ? 'error' : ''}`}
                {...register('end_time', { required: 'La fecha de fin es obligatoria' })}
              />
              {errors.end_time && <span className="error-message">{errors.end_time.message}</span>}
            </div>

            <div className="form-group full-width">
              <label htmlFor="description" className="form-label">
                Descripción (Opcional)
              </label>
              <textarea
                id="description"
                className="form-input"
                rows="4"
                placeholder="Describe los detalles del evento..."
                {...register('description')}
              />
            </div>
          </div>

          <div className="event-modal-actions">
            <div className="actions-left">
              {isEditMode && (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleDelete}
                  disabled={isSubmitting}
                >
                  <FiTrash2 />
                  Eliminar Evento
                </button>
              )}
            </div>
            
            <div className="actions-right">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="loading-spinner"></div>
                ) : isEditMode ? (
                  <>
                    <FiEdit2 />
                    Guardar Cambios
                  </>
                ) : (
                  <>
                    <FiPlus />
                    Crear Evento
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;