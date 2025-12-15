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

      // Validate dates on frontend before sending
      if (data.open_date && data.close_date) {
        const openDate = new Date(data.open_date);
        const closeDate = new Date(data.close_date);
        
        // Check if dates are valid
        if (isNaN(openDate.getTime()) || isNaN(closeDate.getTime())) {
          toast.error('❌ Las fechas proporcionadas no son válidas');
          return;
        }
        
        if (closeDate <= openDate) {
          toast.error('❌ La fecha de cierre debe ser posterior a la fecha de apertura');
          return;
        }
      }

      // Handle file upload with FormData if there's an attachment
      let taskData;
      
      if (data.attachment && data.attachment.length > 0 && data.attachment[0]) {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description || '');
        formData.append('project', project.id);
        formData.append('assigned_to', data.assigned_to ? parseInt(data.assigned_to) : '');
        formData.append('due_date', data.due_date || '');
        formData.append('open_date', data.open_date || '');
        formData.append('close_date', data.close_date || '');
        formData.append('max_score', data.max_score || 100);
        formData.append('allow_late_submissions', data.allow_late_submissions || false);
        formData.append('accept_after_close', data.accept_after_close || false);
        formData.append('days_after_close', data.days_after_close || 0);
        formData.append('attachment', data.attachment[0]);
        
        // Add assigned_students field to FormData (only if array has items)
        // Note: FormData and JSON handle empty arrays differently - FormData omits empty arrays
        // while JSON always includes the field. This is intentional to match Django's expectations.
        if (data.assigned_students && Array.isArray(data.assigned_students) && data.assigned_students.length > 0) {
          data.assigned_students.forEach(studentId => {
            formData.append('assigned_students', studentId);
          });
        }
        
        if (data.status) {
          formData.append('status', data.status);
        }
        taskData = formData;
      } else {
        taskData = {
          ...data,
          project: project.id,
          assigned_to: data.assigned_to ? parseInt(data.assigned_to) : null,
          due_date: data.due_date || null,
          open_date: data.open_date || null,
          close_date: data.close_date || null,
          max_score: data.max_score || 100,
          allow_late_submissions: data.allow_late_submissions || false,
          accept_after_close: data.accept_after_close || false,
          days_after_close: data.days_after_close || 0,
          assigned_students: data.assigned_students || [],  // Add empty array by default
        };
        delete taskData.attachment; // Remove empty attachment field
      }
      
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
      console.error('=== ERROR AL GUARDAR TAREA ===');
      console.error('Error completo:', error);
      console.error('Respuesta del servidor:', error.response?.data);
      console.error('Status code:', error.response?.status);
      console.error('Headers:', error.response?.headers);
      
      // Better error handling for DRF validation errors
      let errorMessage = 'No se pudo guardar la tarea.';
      
      if (error.response?.data) {
        const responseData = error.response.data;
        
        console.log('=== PROCESANDO ERROR ===');
        console.log('Tipo de responseData:', typeof responseData);
        console.log('Es array:', Array.isArray(responseData));
        console.log('Contenido completo:', JSON.stringify(responseData, null, 2));
        
        // Handle validation errors from DRF (can be object with field names)
        if (typeof responseData === 'object' && !Array.isArray(responseData)) {
          const errors = Object.entries(responseData)
            .map(([field, messages]) => {
              const fieldName = field === 'non_field_errors' ? '' : `${field}: `;
              const message = Array.isArray(messages) ? messages.join(', ') : String(messages || '');
              console.log(`Campo: ${field}, Mensajes: ${messages}`);
              return `${fieldName}${message}`;
            })
            .filter(msg => msg.trim().length > 0);
          
          console.log('Errores formateados:', errors);
          errorMessage = errors.length > 0 ? errors.join('\n') : errorMessage;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (typeof responseData === 'string') {
          errorMessage = responseData;
        }
      }
      
      console.error('Mensaje final de error:', errorMessage);
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="task-form">
      <div className="form-section">
        <h3 className="form-section-title">Información Básica</h3>
        
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
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Asignación y Fechas</h3>
        
        <div className="form-grid-2col">
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
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Configuración de Entregas</h3>
        
        {/* New Teams-style fields */}
        <div className="form-grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="open_date">Fecha de Apertura</label>
            <input 
              id="open_date" 
              type="datetime-local" 
              className="form-input" 
              {...register('open_date')} 
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="close_date">Fecha de Cierre *</label>
            <input 
              id="close_date" 
              type="datetime-local" 
              className="form-input" 
              {...register('close_date', {
                required: 'La fecha de cierre es obligatoria'
              })} 
            />
            {errors.close_date && <span className="error-message">{errors.close_date.message}</span>}
          </div>
        </div>

        <div className="form-grid-2col">
          <div className="form-group">
            <label className="form-label" htmlFor="max_score">Puntuación Máxima</label>
            <input 
              id="max_score" 
              type="number" 
              step="0.01"
              min="0"
              max="100"
              className="form-input" 
              {...register('max_score')} 
              defaultValue="100"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="days_after_close">Días Adicionales (Entregas Tardías)</label>
            <input 
              id="days_after_close" 
              type="number" 
              min="0"
              className="form-input" 
              {...register('days_after_close')} 
              defaultValue="0"
            />
          </div>
        </div>

        <div className="form-grid-2col">
          <div className="form-group">
            <label className="form-label checkbox-label">
              <input 
                type="checkbox" 
                {...register('allow_late_submissions')} 
              />
              Permitir Entregas Tardías
            </label>
          </div>

          <div className="form-group">
            <label className="form-label checkbox-label">
              <input 
                type="checkbox" 
                {...register('accept_after_close')} 
              />
              Aceptar Entregas Después del Cierre
            </label>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Recursos Adicionales</h3>
        
        <div className="form-group">
          <label className="form-label" htmlFor="attachment">Archivo Adjunto</label>
          <input 
            id="attachment" 
            type="file" 
            className="form-input file-input" 
            {...register('attachment')}
            accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
          />
          <small className="file-helper-text">
            Formatos permitidos: PDF, DOCX, PPTX, XLSX, imágenes, ZIP, RAR (máx. 100MB)
          </small>
        </div>
      </div>

      {isEditMode && (
        <div className="form-section">
          <h3 className="form-section-title">Estado</h3>
          
          <div className="form-group">
            <label className="form-label" htmlFor="status">Estado de la Tarea</label>
            <select id="status" className="form-select" {...register('status')}>
              <option value="DRAFT">Borrador</option>
              <option value="OPEN">Abierta</option>
              <option value="IN_REVIEW">En Revisión</option>
              <option value="CLOSED">Cerrada</option>
              <option value="REOPENED">Reabierta</option>
              {/* Legacy statuses */}
              <option value="PENDING">Pendiente</option>
              <option value="IN_PROGRESS">En Progreso</option>
              <option value="FOR_REVIEW">En Revisión</option>
              <option value="COMPLETED">Completada</option>
            </select>
          </div>
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
        <div className="form-info">
          <p><strong>Proyecto:</strong> {project.name}</p>
          {project.description && (
            <p className="project-description"><strong>Descripción del proyecto:</strong> {project.description}</p>
          )}
        </div>
      )}
    </form>
  );
};

export default TaskForm;