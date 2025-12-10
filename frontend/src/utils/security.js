/**
 * Utilidades de seguridad para el frontend
 */

/**
 * Sanitiza entrada de texto para prevenir XSS
 * @param {string} input - El texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  const reg = /[&<>"'/]/ig;
  return input.replace(reg, (match) => map[match]);
};

/**
 * Valida la fortaleza de una contraseña
 * @param {string} password - Contraseña a validar
 * @returns {object} - Objeto con resultado de validación
 */
export const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (password.length < 12) {
    errors.push('La contraseña debe tener al menos 12 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Genera un token CSRF desde las cookies
 * @returns {string|null} - Token CSRF o null si no existe
 */
export const getCsrfToken = () => {
  const name = 'csrftoken';
  let cookieValue = null;
  
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  
  return cookieValue;
};

/**
 * Valida que una URL sea segura (previene open redirect)
 * @param {string} url - URL a validar
 * @returns {boolean} - true si es segura
 */
export const isSafeUrl = (url) => {
  if (!url) return false;
  
  // Si comienza con / es una URL relativa y es segura
  if (url.startsWith('/')) return true;
  
  // Si no, debe ser del mismo dominio
  try {
    const urlObj = new URL(url, window.location.origin);
    return urlObj.origin === window.location.origin;
  } catch (e) {
    return false;
  }
};

/**
 * Escapa caracteres especiales en HTML
 * @param {string} text - Texto a escapar
 * @returns {string} - Texto escapado
 */
export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Verifica si el contenido tiene posibles scripts maliciosos
 * @param {string} content - Contenido a verificar
 * @returns {boolean} - true si detecta contenido sospechoso
 */
export const detectMaliciousContent = (content) => {
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(content));
};

/**
 * Limpia y valida datos de formulario
 * @param {object} formData - Datos del formulario
 * @returns {object} - Datos sanitizados
 */
export const sanitizeFormData = (formData) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      // Sanitizar strings
      sanitized[key] = sanitizeInput(value.trim());
    } else if (Array.isArray(value)) {
      // Sanitizar arrays
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item.trim()) : item
      );
    } else {
      // Mantener otros tipos sin cambios
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

export default {
  sanitizeInput,
  validatePasswordStrength,
  getCsrfToken,
  isSafeUrl,
  escapeHtml,
  detectMaliciousContent,
  sanitizeFormData,
};
