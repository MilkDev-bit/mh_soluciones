import React, { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form'; // Esta importación faltaba
import toast from 'react-hot-toast';
import { createProject, updateProject } from '../../services/projectService';
import { getClients } from '../../services/userService'
import '../../assets/styles/_buttons.scss';
import './ProjectForm.scss';

const ProjectForm = ({ project, onProjectSaved, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm();
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const isEditMode = Boolean(project);

  const clientValue = watch('client');

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
      
      if (project.client) {
        const clientId = project.client?.id || project.client;
        const client = clients.find(c => c.id.toString() === clientId.toString());
        if (client) {
          setSelectedClient(client);
        }
      }
    }
  }, [project, isEditMode, setValue, clients]);

  useEffect(() => {
    if (clientValue && clients.length > 0) {
      const client = clients.find(c => c.id.toString() === clientValue.toString());
      setSelectedClient(client || null);
    } else {
      setSelectedClient(null);
    }
  }, [clientValue, clients]);

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

  const filteredClients = clients.filter(client => {
    if (!searchTerm.trim()) return true;
    
    const fullName = `${client.first_name || ''} ${client.last_name || ''}`.toLowerCase();
    const email = client.email ? client.email.toLowerCase() : '';
    const searchLower = searchTerm.toLowerCase();
    
    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectClient = (client) => {
    setValue('client', client.id.toString(), { shouldValidate: true });
    setSelectedClient(client);
    setSearchTerm('');
    setIsDropdownOpen(false);
  };

  const handleRemoveSelection = () => {
    setValue('client', '', { shouldValidate: true });
    setSelectedClient(null);
    setSearchTerm('');
  };

  const handleDropdownToggle = () => {
    if (clients.length === 0) {
      toast.error('No hay clientes disponibles');
      return;
    }
    
    setIsDropdownOpen(!isDropdownOpen);
    if (!isDropdownOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  };

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
        <label htmlFor="client" className="form-label">Cliente *</label>
        
        <input
          type="hidden"
          {...register('client', { required: 'El cliente es obligatorio' })}
        />
        
        <div className="custom-select" ref={dropdownRef}>
          <div 
            className={`select-trigger ${errors.client ? 'error' : ''}`}
            onClick={handleDropdownToggle}
          >
            {selectedClient ? (
              <div className="selected-item">
                <span>
                  {selectedClient.first_name} {selectedClient.last_name} 
                  {selectedClient.email ? ` (${selectedClient.email})` : ''}
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
              <span className="placeholder">Seleccionar cliente...</span>
            )}
            <span className="dropdown-arrow">▼</span>
          </div>
          
          {errors.client && <span className="error-message">{errors.client.message}</span>}
          
          {isDropdownOpen && (
            <div className="dropdown-menu">
              <div className="search-container">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar cliente por nombre o email..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                />
              </div>
              
              <div className="dropdown-options">
                {filteredClients.length > 0 ? (
                  filteredClients.map(client => (
                    <div
                      key={client.id}
                      className={`dropdown-option ${
                        selectedClient?.id === client.id ? 'selected' : ''
                      }`}
                      onClick={() => handleSelectClient(client)}
                    >
                      <div className="client-info">
                        <div className="client-name">
                          {client.first_name} {client.last_name}
                        </div>
                        <div className="client-email">
                          {client.email}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="dropdown-option disabled">
                    {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
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