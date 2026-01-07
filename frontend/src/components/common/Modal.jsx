import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import './Modal.scss';

/**
 * Accessible Modal component with keyboard navigation and focus trap
 */
const Modal = ({ title, children, onClose, size = 'medium' }) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Store the previously focused element and restore it on close
  useEffect(() => {
    previousActiveElement.current = document.activeElement;
    document.body.classList.add('modal-open');
    
    // Focus the modal container for accessibility
    if (modalRef.current) {
      modalRef.current.focus();
    }
    
    return () => {
      document.body.classList.remove('modal-open');
      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, []);

  // Handle overlay click - only close if click was directly on overlay
  const handleOverlayClick = useCallback((e) => {
    // Solo cierra si el click fue directamente en el overlay
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    // Focus trap - keep focus within modal
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }, [onClose]);

  const sizeClasses = {
    small: 'modal-small',
    medium: 'modal-medium',
    large: 'modal-large',
    xlarge: 'modal-xlarge'
  };

  const modalContent = (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={modalRef}
        className={`modal-content ${sizeClasses[size]}`}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2 id="modal-title" className="modal-title">{title}</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
            type="button"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>
        <div className="modal-body" role="document">{children}</div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;