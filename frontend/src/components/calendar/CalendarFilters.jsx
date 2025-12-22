import React from 'react';
import { FiFilter, FiX } from 'react-icons/fi';
import './CalendarFilters.scss';

const CalendarFilters = ({ filters, onFilterChange, onClearFilters, users = [], availableColors = [] }) => {
  const hasActiveFilters = filters.category || filters.user || filters.searchQuery;

  return (
    <div className="calendar-filters glass-card">
      <div className="filters-header">
        <div className="filters-title">
          <FiFilter />
          <span>Filtros</span>
        </div>
        {hasActiveFilters && (
          <button 
            className="btn btn-ghost btn-sm"
            onClick={onClearFilters}
            title="Limpiar filtros"
          >
            <FiX />
            Limpiar
          </button>
        )}
      </div>

      <div className="filters-content">
        <div className="filter-group">
          <label htmlFor="search-filter" className="filter-label">
            Buscar evento
          </label>
          <input
            id="search-filter"
            type="text"
            className="form-input"
            placeholder="Buscar por título..."
            value={filters.searchQuery || ''}
            onChange={(e) => onFilterChange('searchQuery', e.target.value)}
          />
        </div>

        {availableColors.length > 0 && (
          <div className="filter-group">
            <label htmlFor="category-filter" className="filter-label">
              Categoría / Color
            </label>
            <select
              id="category-filter"
              className="form-select"
              value={filters.category || ''}
              onChange={(e) => onFilterChange('category', e.target.value)}
            >
              <option value="">Todos los colores</option>
              {availableColors.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filters.category && (
              <div 
                className="color-preview-badge"
                style={{ backgroundColor: filters.category }}
              />
            )}
          </div>
        )}

        {users.length > 0 && (
          <div className="filter-group">
            <label htmlFor="user-filter" className="filter-label">
              Creado por
            </label>
            <select
              id="user-filter"
              className="form-select"
              value={filters.user || ''}
              onChange={(e) => onFilterChange('user', e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>
                  {`${user.first_name} ${user.last_name}`.trim() || user.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarFilters;
