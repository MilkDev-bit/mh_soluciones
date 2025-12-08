import React from 'react';
import './FormTextarea.scss';

const FormTextarea = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  maxLength,
  minLength,
  resize = 'vertical',
  className = '',
  ...rest
}) => {
  const hasError = !!error;

  return (
    <div className={`form-textarea-wrapper ${className}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      
      <div className={`form-textarea-container ${hasError ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          minLength={minLength}
          className={`form-textarea resize-${resize}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-error` : helperText ? `${name}-helper` : undefined}
          {...rest}
        />
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
      
      {maxLength && (
        <span className="character-count">
          {value?.length || 0}/{maxLength}
        </span>
      )}
    </div>
  );
};

export default FormTextarea;
