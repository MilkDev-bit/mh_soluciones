import React, { useEffect, useState, useRef, useContext } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createTask, updateTask } from '../../services/taskService';
import { todayLocalISO } from '../../utils/taskStatus';
import { FiPlus, FiTrash2, FiAward, FiAlertCircle } from 'react-icons/fi';
import '../../assets/styles/_buttons.scss';
import './TaskForm.scss';

const TaskForm = ({ project, task, onTaskSaved, onCancel, projectMembers = [] }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [gradingCriteria, setGradingCriteria] = useState([]);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isEditMode = Boolean(task);

  // Convierte una ISO UTC string del backend al formato que acepta datetime-local ("YYYY-MM-DDTHH:MM")
  // mostrando la hora en la zona local del navegador.
  const utcToDatetimeLocal = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  };

  // Convierte un valor de datetime-local ("YYYY-MM-DDTHH:MM") a ISO con offset local
  // para que el backend sepa exactamente la hora y zona horaria.
  const datetimeLocalToISO = (value) => {
    if (!value) return null;
    try {
      const d = new Date(value); // interpreta como hora local del navegador
      if (isNaN(d.getTime())) return null;
      return d.toISOString(); // UTC ISO — DRF lo interpreta correctamente cuando incluye Z
    } catch {
      return null;
    }
  };

  const maxScore = watch('max_score') || 100;
  const isContinuous = watch('is_continuous');
  const allowLate = watch('allow_late_submissions');

  useEffect(() => {
    if (isEditMode && task) {
      setValue('title', task.title);
      setValue('description', task.description);
      setValue('due_date', task.due_date);
      setValue('assigned_to', task.assigned_to?.id || '');
      setValue('status', task.status);
      setValue('open_date', utcToDatetimeLocal(task.open_date));
      setValue('close_date', utcToDatetimeLocal(task.close_date));
      setValue('max_score', task.max_score || 100);
      setValue('allow_late_submissions', task.allow_late_submissions || false);
      setValue('accept_after_close', task.accept_after_close || false);
      setValue('days_after_close', task.days_after_close || 0);
      setValue('is_continuous', task.is_continuous || false);
      
      // Load assigned students: prefer assigned_students_data (array), fall back to assigned_to
      if (Array.isArray(task.assigned_students_data) && task.assigned_students_data.length > 0) {
        setSelectedMembers(task.assigned_students_data);
      } else if (task.assigned_to) {
        setSelectedMembers([task.assigned_to]);
      }
      
      // Load grading criteria if available
      if (task.grading_criteria && Array.isArray(task.grading_criteria)) {
        setGradingCriteria(task.grading_criteria);
      }
    }
  }, [task, isEditMode, setValue]);

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
    setSelectedMembers(prev => {
      const alreadySelected = prev.some(m => m.id === member.id);
      if (alreadySelected) {
        return prev.filter(m => m.id !== member.id);
      }
      return [...prev, member];
    });
    setSearchTerm('');
  };

  const handleRemoveMember = (memberId) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== memberId));
  };

  const handleDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

  // Grading criteria management
  const addCriterion = () => {
    setGradingCriteria([...gradingCriteria, { name: '', description: '', points: 0 }]);
  };

  const removeCriterion = (index) => {
    setGradingCriteria(gradingCriteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index, field, value) => {
    const updated = [...gradingCriteria];
    updated[index][field] = field === 'points' ? parseFloat(value) || 0 : value;
    setGradingCriteria(updated);
  };

  const getTotalCriteriaPoints = () => {
    return gradingCriteria.reduce((sum, criterion) => sum + (parseFloat(criterion.points) || 0), 0);
  };

  const onSubmit = async (data) => {
    try {
      if (!project || !project.id) {
        toast.error('No se puede crear la tarea: proyecto no seleccionado');
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
      
      // Access file directly from DOM instead of relying on react-hook-form
      // react-hook-form has known issues with file inputs
      const fileInput = fileInputRef.current;
      const hasFile = fileInput && 
                     fileInput.files && 
                     fileInput.files.length > 0 && 
                     fileInput.files[0] instanceof File;
      
      // assigned_to is kept for backend compatibility; the full list is sent via assigned_students
      const assignedUserId = selectedMembers.length > 0 ? selectedMembers[0].id : null;
      const assignedStudentsList = selectedMembers.map(m => m.id);
      
      if (hasFile) {
        const formData = new FormData();
        formData.append('title', data.title);
        formData.append('description', data.description || '');
        formData.append('project', project.id);
        formData.append('assigned_to', assignedUserId || '');
        formData.append('due_date', data.due_date || '');
        formData.append('open_date', datetimeLocalToISO(data.open_date) || '');
        formData.append('close_date', datetimeLocalToISO(data.close_date) || '');
        formData.append('max_score', data.max_score || 100);
        formData.append('allow_late_submissions', data.allow_late_submissions || false);
        formData.append('accept_after_close', data.accept_after_close || false);
        formData.append('days_after_close', data.days_after_close || 0);
        formData.append('is_continuous', data.is_continuous || false);
        formData.append('attachment', fileInput.files[0]);
        formData.append('grading_criteria', JSON.stringify(gradingCriteria));
        
        assignedStudentsList.forEach(studentId => {
          formData.append('assigned_students', studentId);
        });
        
        // Set status with default to PENDING if not provided
        formData.append('status', data.status || 'PENDING');
        taskData = formData;
      } else {
        taskData = {
          ...data,
          project: project.id,
          assigned_to: assignedUserId,
          due_date: data.due_date || null,
          open_date: datetimeLocalToISO(data.open_date),
          close_date: datetimeLocalToISO(data.close_date),
          max_score: data.max_score || 100,
          allow_late_submissions: data.allow_late_submissions || false,
          accept_after_close: data.accept_after_close || false,
          days_after_close: data.days_after_close || 0,
          is_continuous: data.is_continuous || false,
          grading_criteria: gradingCriteria,
          assigned_students: assignedStudentsList,
          status: data.status || 'PENDING',  // Set default status to PENDING
        };
        
        // Remove attachment field completely if it's empty or an empty object
        delete taskData.attachment;
      }

      const savedTask = isEditMode
        ? await updateTask(task.id, taskData)
        : await createTask(taskData);

      if (onTaskSaved) {
        onTaskSaved(savedTask, isEditMode);
      }
      
      toast.success(isEditMode ? 'Tarea actualizada!' : 'Tarea creada!');
      
    } catch (error) {
      let errorMessage = 'No se pudo guardar la tarea.';
      
      if (error.response?.data) {
        const responseData = error.response.data;
        
        if (typeof responseData === 'object' && !Array.isArray(responseData)) {
          const errors = Object.entries(responseData)
            .map(([field, messages]) => {
              const fieldName = field === 'non_field_errors' ? '' : `${field}: `;
              const message = Array.isArray(messages) ? messages.join(', ') : String(messages || '');
              return `${fieldName}${message}`;
            })
            .filter(msg => msg.trim());
          
          errorMessage = errors.length > 0 ? errors.join('\n') : errorMessage;
        } else if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (responseData.message) {
          errorMessage = responseData.message;
        } else if (typeof responseData === 'string') {
          errorMessage = responseData;
        }
      }
      
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
              {...register('due_date', {
                // Si no hay hora de cierre, se propone el fin del día elegido.
                onChange: (e) => {
                  if (e.target.value && !watch('close_date')) {
                    setValue('close_date', `${e.target.value}T23:59`);
                  }
                },
              })} 
              min={todayLocalISO()}
              disabled={isContinuous}
            />
            <small className="form-hint">La tarea vence al final de este día (hora local) o a la hora de cierre indicada abajo.</small>
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
                {selectedMembers.length > 0 ? (
                  <div className="selected-members-list">
                    {selectedMembers.map(member => (
                      <span key={member.id} className="selected-member-tag">
                        {member.first_name} {member.last_name}
                        <button
                          type="button"
                          className="tag-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMember(member.id);
                          }}
                          aria-label={`Quitar ${member.first_name} ${member.last_name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="placeholder">Seleccionar estudiantes...</span>
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
                            selectedMembers.some(m => m.id === member.id) ? 'selected' : ''
                          }`}
                          onClick={() => handleSelectMember(member)}
                        >
                          <span className="option-check">
                            {selectedMembers.some(m => m.id === member.id) ? '✓ ' : ''}
                          </span>
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

        <div className="form-group">
          <label className="form-label checkbox-label">
            <input type="checkbox" {...register('is_continuous')} />
            Actividad continua (siempre abierta, nunca vence)
          </label>
          <small className="form-hint">
            Úsala para actividades permanentes como GRAFICAS: se pueden reasignar cada semana sin que aparezcan como vencidas.
          </small>
        </div>
        
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
            <label className="form-label" htmlFor="close_date">Fecha y Hora de Cierre {isContinuous ? '' : '*'}</label>
            <input 
              id="close_date" 
              type="datetime-local" 
              className="form-input" 
              {...register('close_date', {
                validate: (value) => isContinuous || !!value || 'La fecha de cierre es obligatoria',
              })} 
              disabled={isContinuous}
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
            <label className="form-label checkbox-label">
              <input 
                type="checkbox" 
                {...register('allow_late_submissions')} 
                disabled={isContinuous}
              />
              Permitir entregas tardías
            </label>
            {allowLate && !isContinuous && (
              <>
                <label className="form-label" htmlFor="days_after_close">Días de gracia después del vencimiento</label>
                <input 
                  id="days_after_close" 
                  type="number" 
                  min="0"
                  max="60"
                  className="form-input" 
                  {...register('days_after_close', { min: { value: 0, message: 'No puede ser negativo' } })} 
                  defaultValue="0"
                />
                <small className="form-hint">
                  Los alumnos podrán entregar durante estos días y la entrega quedará marcada como tardía. 0 = sin límite.
                  No necesitas cambiar la fecha ni reasignar la tarea.
                </small>
              </>
            )}
          </div>
        </div>

        <div className="form-grid-2col">
          <div className="form-group">
            <label className="form-label checkbox-label">
              <input 
                type="checkbox" 
                {...register('accept_after_close')} 
              />
              Aceptar entregas aunque la tarea esté cerrada
            </label>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3 className="form-section-title">
            <FiAward style={{ marginRight: '0.5rem', color: '#f97316' }} />
            Criterios de Calificación
          </h3>
          <button 
            type="button" 
            className="btn btn-sm btn-secondary"
            onClick={addCriterion}
          >
            <FiPlus /> Agregar Criterio
          </button>
        </div>
        
        {gradingCriteria.length > 0 && (
          <div className="grading-criteria-list">
            {gradingCriteria.map((criterion, index) => (
              <div key={index} className="criterion-item">
                <div className="criterion-header">
                  <span className="criterion-number">Criterio {index + 1}</span>
                  <button
                    type="button"
                    className="btn-icon btn-danger-ghost"
                    onClick={() => removeCriterion(index)}
                    aria-label="Eliminar criterio"
                  >
                    <FiTrash2 />
                  </button>
                </div>
                
                <div className="criterion-fields">
                  <div className="form-group">
                    <label className="form-label">Nombre del Criterio *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(index, 'name', e.target.value)}
                      placeholder="ej. Contenido, Presentación, Ortografía"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      value={criterion.description}
                      onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                      placeholder="Breve descripción del criterio"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Puntos *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9]*\.?[0-9]*"
                      className="form-input points-input"
                      value={criterion.points || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Permitir campo vacío o números decimales
                        if (value === '' || /^\d*\.?\d*$/.test(value)) {
                          const numValue = parseFloat(value);
                          // Validar rango solo si hay valor
                          if (value === '' || (!isNaN(numValue) && numValue >= 0 && numValue <= maxScore)) {
                            updateCriterion(index, 'points', value);
                          } else if (!isNaN(numValue)) {
                            toast.error(`Los puntos deben estar entre 0 y ${maxScore}`);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        // Al perder foco, asegurar número válido
                        const value = e.target.value;
                        if (value === '') {
                          updateCriterion(index, 'points', 0);
                        } else {
                          const numValue = parseFloat(value);
                          if (!isNaN(numValue)) {
                            // Clamp entre 0 y maxScore
                            const clampedValue = Math.min(Math.max(numValue, 0), maxScore);
                            updateCriterion(index, 'points', clampedValue);
                          }
                        }
                      }}
                      placeholder="Ej: 25"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <div className="criteria-summary">
              <strong>Total de Puntos en Criterios:</strong> {getTotalCriteriaPoints()}
              {maxScore && getTotalCriteriaPoints() !== parseFloat(maxScore) && (
                <span className="criteria-warning">
                  <FiAlertCircle style={{ marginRight: '0.25rem' }} />
                  La suma de criterios ({getTotalCriteriaPoints()}) no coincide con la puntuación máxima ({maxScore})
                </span>
              )}
            </div>
          </div>
        )}
        
        {gradingCriteria.length === 0 && (
          <div className="empty-criteria">
            <p>No hay criterios de calificación definidos. Los criterios te permiten evaluar diferentes aspectos de la entrega.</p>
          </div>
        )}
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Recursos Adicionales</h3>
        
        <div className="form-group">
          <label className="form-label" htmlFor="attachment">Archivo Adjunto</label>
          <input 
            ref={fileInputRef}
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

      <div className="form-section">
        <h3 className="form-section-title">Estado</h3>
        
        <div className="form-group">
          <label className="form-label" htmlFor="status">Estado de la Tarea</label>
          <select id="status" className="form-select" {...register('status')} defaultValue="PENDING">
            {/* Legacy statuses - most commonly used */}
            <option value="PENDING">Pendiente</option>
            <option value="IN_PROGRESS">En Progreso</option>
            <option value="FOR_REVIEW">Para Revisión</option>
            <option value="COMPLETED">Completada</option>
            {/* New statuses */}
            <option value="DRAFT">Borrador</option>
            <option value="OPEN">Abierta</option>
            <option value="IN_REVIEW">En Revisión</option>
            <option value="CLOSED">Cerrada</option>
            <option value="REOPENED">Reabierta</option>
          </select>
        </div>
      </div>
      
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