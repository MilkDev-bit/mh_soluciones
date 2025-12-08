import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import './FormInput.scss';

const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  helperText,
  placeholder,
  required = false,
  disabled = false,
  autoComplete,
  icon: Icon,
  maxLength,
  minLength,
  pattern,
  validate,
  showPasswordToggle = false,
  success,
  className = '',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  const inputType = type === 'password' && showPassword ? 'text' : type;

  useEffect(() => {
    if (error) {
      setValidationError(error);
    } else {
      setValidationError('');
    }
  }, [error]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Validate on change if validate function is provided
    if (validate && newValue) {
      const validateResult = validate(newValue);
      if (validateResult !== true) {
        setValidationError(validateResult || 'Valor inválido');
      } else {
        setValidationError('');
      }
    }
    
    if (onChange) {
      onChange(e);
    }
  };

  const handleBlur = (e) => {
    setIsFocused(false);
    
    // Validate on blur
    if (validate && value) {
      const validateResult = validate(value);
      if (validateResult !== true) {
        setValidationError(validateResult || 'Valor inválido');
      }
    }
    
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const hasError = !!validationError || !!error;
  const hasSuccess = !hasError && success;

  return (
    <div className={`form-input-wrapper ${className}`}>
      {label && (
        <label htmlFor={name} className={`form-label ${required ? 'required' : ''}`}>
          {label}
        </label>
      )}
      
      <div className={`form-input-container ${isFocused ? 'focused' : ''} ${hasError ? 'error' : ''} ${hasSuccess ? 'success' : ''} ${disabled ? 'disabled' : ''}`}>
        {Icon && (
          <span className="form-input-icon">
            <Icon />
          </span>
        )}
        
        <input
          id={name}
          name={name}
          type={inputType}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          minLength={minLength}
          pattern={pattern}
          className={`form-input ${Icon ? 'has-icon' : ''} ${showPasswordToggle ? 'has-toggle' : ''}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${name}-error` : helperText ? `${name}-helper` : undefined}
          {...rest}
        />
        
        {showPasswordToggle && type === 'password' && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            tabIndex={-1}
          >
            {showPassword ? <FiEyeOff /> : <FiEye />}
          </button>
        )}
        
        {hasError && (
          <span className="form-input-status error-icon">
            <FiAlertCircle />
          </span>
        )}
        
        {hasSuccess && (
          <span className="form-input-status success-icon">
            <FiCheckCircle />
          </span>
        )}
      </div>
      
      {hasError && (
        <span className="form-message error-message" id={`${name}-error`} role="alert">
          <FiAlertCircle />
          {validationError || error}
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

export default FormInput;
