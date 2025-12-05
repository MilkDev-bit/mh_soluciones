import React from 'react';
import './Common.scss';

/**
 * Loading component with multiple variants for better UX
 * @param {boolean} fullscreen - Whether to show fullscreen overlay
 * @param {string} text - Optional loading text to display
 * @param {string} size - Size variant: 'small', 'medium', 'large'
 * @param {boolean} inline - Whether to render inline (no overlay)
 */
const Loading = ({ 
  fullscreen = false, 
  text = '', 
  size = 'medium',
  inline = false 
}) => {
  if (inline) {
    return (
      <div className={`loading-inline loading-${size}`} role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true"></div>
        {text && <span className="loading-text">{text}</span>}
        <span className="sr-only">{text || 'Cargando...'}</span>
      </div>
    );
  }

  const loadingClass = fullscreen ? 'loading-overlay fullscreen' : 'loading-overlay';

  return (
    <div className={loadingClass} role="status" aria-live="polite" aria-busy="true">
      <div className="loading-content">
        <div className={`spinner spinner-${size}`} aria-hidden="true"></div>
        {text && <p className="loading-text">{text}</p>}
        <span className="sr-only">{text || 'Cargando...'}</span>
      </div>
    </div>
  );
};

/**
 * Button loading spinner for inline button loading states
 * Note: The button text should be updated to indicate loading state for screen readers
 * (e.g., "Guardando..." instead of "Guardar")
 */
export const ButtonSpinner = ({ label = 'Cargando' }) => (
  <span className="button-spinner" role="status">
    <svg className="spinner-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle className="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
      <path className="spinner-head" d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
    </svg>
    <span className="sr-only">{label}</span>
  </span>
);

/**
 * Skeleton loader for content placeholders
 */
export const Skeleton = ({ width, height, borderRadius = '4px', className = '' }) => (
  <div 
    className={`skeleton ${className}`}
    style={{ 
      width: width || '100%', 
      height: height || '1em',
      borderRadius 
    }}
    aria-hidden="true"
  />
);

/**
 * Card skeleton for project/task cards
 */
export const CardSkeleton = () => (
  <div className="card-skeleton" aria-hidden="true">
    <Skeleton height="120px" borderRadius="8px" />
    <div style={{ padding: '1rem' }}>
      <Skeleton width="70%" height="1.25rem" />
      <Skeleton width="40%" height="0.875rem" className="mt-2" />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <Skeleton width="60px" height="24px" borderRadius="12px" />
        <Skeleton width="60px" height="24px" borderRadius="12px" />
      </div>
    </div>
  </div>
);

export default Loading;