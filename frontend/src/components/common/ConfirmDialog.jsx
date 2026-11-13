import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiHelpCircle } from 'react-icons/fi';
import './ConfirmDialog.scss';

/*
 * Reemplazo de window.confirm: un modal con los colores del tema.
 *
 *   import { confirmDialog } from '../common/ConfirmDialog';
 *   if (!(await confirmDialog({ title: 'Eliminar tarea', message: '...', danger: true }))) return;
 *
 * Devuelve una promesa que resuelve true (Aceptar) o false (Cancelar / Esc /
 * clic fuera). <ConfirmDialogHost /> se monta una sola vez en main.jsx.
 */

let enqueue = null;
const pending = [];

export const confirmDialog = (options) => new Promise((resolve) => {
  const opts = typeof options === 'string' ? { message: options } : (options || {});
  const request = { ...opts, resolve };
  if (enqueue) enqueue(request);
  else pending.push(request);   // por si se llama antes de montar el host
});

export const ConfirmDialogHost = () => {
  const [queue, setQueue] = useState([]);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = (req) => setQueue((q) => [...q, req]);
    if (pending.length) setQueue((q) => [...q, ...pending.splice(0)]);
    return () => { enqueue = null; };
  }, []);

  const close = useCallback((result) => {
    setQueue((q) => {
      if (q[0]) q[0].resolve(result);
      return q.slice(1);
    });
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    const prevFocus = document.activeElement;
    // En acciones destructivas el foco inicial va en Cancelar: un Enter por
    // descuido no borra nada.
    (current.danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, [current, close]);

  if (!current) return null;

  const {
    title = '¿Confirmar acción?',
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    danger = false,
  } = current;
  const Icon = danger ? FiAlertTriangle : FiHelpCircle;

  return createPortal(
    <div className="confirm-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div
        className={`confirm-dialog ${danger ? 'is-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
      >
        <div className="confirm-dialog-icon"><Icon aria-hidden="true" /></div>
        <div className="confirm-dialog-body">
          <h3 id="confirm-dialog-title">{title}</h3>
          {message && (
            <div id="confirm-dialog-message" className="confirm-dialog-message">
              {String(message).split('\n').filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" ref={cancelRef} className="confirm-dialog-cancel" onClick={() => close(false)}>
            {cancelText}
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`confirm-dialog-confirm ${danger ? 'danger' : ''}`}
            onClick={() => close(true)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default confirmDialog;
