import React from 'react';
import { FiChevronDown } from 'react-icons/fi';
import './FormSelect.scss';

const FormSelect = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  placeholder = 'Seleccionar...',
  required = false,
  disabled = false,
  options = [],
  className = '',
  icon: Icon,
  ...rest
}) => {
  const hasError = !!error;

  return (
    <div className={`form-select-wrapper ${className}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      
      <div className={`form-select-container ${hasError ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
        {Icon && (
          <span className="form-select-icon">
            <Icon />
          </span>
        )}
        
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`form-select ${Icon ? 'has-icon' : ''}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-error` : helperText ? `${name}-helper` : undefined}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        
        <span className="form-select-arrow">
          <FiChevronDown />
        </span>
      </div>
      
      {hasError && (
        <span className="form-message error-message" id={`${name}-error`} role="alert">
          {error}
        </span>
      )}
      
      {!hasError && helperText && (
        <span className="form-message helper-text" id={`${name}-helper`}>
          {helperText}
        </span>
      )}
    </div>
  );
};

export default FormSelect;
