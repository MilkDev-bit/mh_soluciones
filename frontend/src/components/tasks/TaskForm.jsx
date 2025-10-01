import React, { useEffect, useState, useRef, useContext } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createTask, updateTask } from '../../services/taskService';
import '../../assets/styles/_buttons.scss';
import './TaskForm.scss';

const TaskForm = ({ project, task, onTaskSaved, onCancel, projectMembers = [] }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const isEditMode = Boolean(task);

  const assignedToValue = watch('assigned_to');

  useEffect(() => {
    if (isEditMode && task) {
      setValue('title', task.title);
      setValue('description', task.description);
      setValue('due_date', task.due_date);
      setValue('assigned_to', task.assigned_to?.id || '');
      setValue('status', task.status);
      
      if (task.assigned_to) {
        setSelectedMember(task.assigned_to);
      }
    }
  }, [task, isEditMode, setValue]);

  useEffect(() => {
    if (assignedToValue) {
      const member = projectMembers.find(m => m.id.toString() === assignedToValue.toString());
      setSelectedMember(member || null);
    } else {
      setSelectedMember(null);
    }
  }, [assignedToValue, projectMembers]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredMembers = projectMembers.filter(member => {
    if (!searchTerm.trim()) return true;
    
    const fullName = `${member.first_name || ''} ${member.last_name || ''}`.toLowerCase();
    const email = member.email ? member.email.toLowerCase() : '';
    const searchLower = searchTerm.toLowerCase();
    
    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectMember = (member) => {
    setValue('assigned_to', member.id.toString());
    setSelectedMember(member);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleRemoveSelection = () => {
    setValue('assigned_to', '');
    setSelectedMember(null);
    setSearchTerm('');
  };

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  const onSubmit = async (data) => {
    try {
      console.log('Datos del formulario:', data);
      
      if (!project || !project.id) {
        toast.error('No se puede crear la tarea: proyecto no seleccionado');
        console.error('Project no definido:', project);
        return;
      }

      const taskData = {
        ...data,
        project: project.id,
        assigned_to: data.assigned_to ? parseInt(data.assigned_to) : null,
        due_date: data.due_date || null
      };
      
      console.log('Datos enviados al servidor:', taskData);

      const savedTask = isEditMode
        ? await updateTask(task.id, taskData)
        : await createTask(taskData);

      console.log('Respuesta del servidor:', savedTask);

      if (onTaskSaved) {
        onTaskSaved(savedTask, isEditMode);
        toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada!');
      } else {
        console.error('onTaskSaved no está definido!');
        toast.success('Operación completada, pero no se actualizó la lista');
      }
      
    } catch (error) {
      console.error('Error completo al guardar tarea:', error);
      console.error('Respuesta del error:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.detail || 
                          error.message || 
                          'No se pudo guardar la tarea.';
      
      toast.error(errorMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="form">
      <div className="form-group">
        <label className="form-label" htmlFor="title">Título de la Tarea *</label>
        <input
          id="title"
          type="text"
          className="form-input"
          {...register('title', { 
            required: 'El título es obligatorio',
            minLength: {
              value: 3,
              message: 'El título debe tener al menos 3 caracteres'
            },
            maxLength: {
              value: 255,
              message: 'El título no puede exceder los 255 caracteres'
            }
          })}
        />
        {errors.title && <span className="error-message">{errors.title.message}</span>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="description">Descripción</label>
        <textarea
          id="description"
          className="form-input"
          rows="3"
          {...register('description', {
            maxLength: {
              value: 1000,
              message: 'La descripción no puede exceder los 1000 caracteres'
            }
          })}
        ></textarea>
        {errors.description && <span className="error-message">{errors.description.message}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="due_date">Fecha de Vencimiento</label>
          <input 
            id="due_date" 
            type="date" 
            className="form-input" 
            {...register('due_date')} 
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Asignar a</label>
          
          <input
            type="hidden"
            {...register('assigned_to')}
          />
          
          <div className="custom-select" ref={dropdownRef}>
            <div 
              className="select-trigger"
              onClick={handleDropdownToggle}
            >
              {selectedMember ? (
                <div className="selected-member">
                  <span>
                    {selectedMember.first_name} {selectedMember.last_name}
                    {selectedMember.email ? ` (${selectedMember.email})` : ''}
                  </span>
                  <button 
                    type="button"
                    className="clear-selection"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSelection();
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <span className="placeholder">Seleccionar miembro...</span>
              )}
              <span className="dropdown-arrow">▼</span>
            </div>
            
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <div className="search-container">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                </div>
                
                <div className="dropdown-options">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map(member => (
                      <div
                        key={member.id}
                        className={`dropdown-option ${
                          selectedMember?.id === member.id ? 'selected' : ''
                        }`}
                        onClick={() => handleSelectMember(member)}
                      >
                        {member.first_name} {member.last_name}
                        {member.email ? ` (${member.email})` : ''}
                      </div>
                    ))
                  ) : (
                    <div className="dropdown-option disabled">
                      {searchTerm ? 'No se encontraron miembros' : 'No hay miembros disponibles'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditMode && (
        <div className="form-group">
          <label className="form-label" htmlFor="status">Estado</label>
          <select id="status" className="form-select" {...register('status')}>
            <option value="PENDING">Pendiente</option>
            <option value="IN_PROGRESS">En Progreso</option>
            <option value="FOR_REVIEW">En Revisión</option>
            <option value="COMPLETED">Completada</option>
          </select>
        </div>
      )}
      
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button 
          type="submit" 
          className="btn btn-primary" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Crear Tarea')}
        </button>
      </div>

      {project && (
        <div className="form-info" style={{ marginTop: '20px' }}>
          <p><strong>Proyecto:</strong> {project.name}</p>
          {project.description && (
            <p><strong>Descripción del proyecto:</strong> {project.description}</p>
          )}
        </div>
      )}
    </form>
  );
};

export default TaskForm;