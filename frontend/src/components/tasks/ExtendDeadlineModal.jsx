import { useState, useMemo, useEffect, useRef } from 'react';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FiCalendar, FiUsers, FiRotateCw } from 'react-icons/fi';
import Modal from '../common/Modal';
import './ExtendDeadlineModal.scss';

const QUICK_DAYS = [1, 3, 7, 14];
const MIN_DAYS = 1;
const MAX_DAYS = 60;

/**
 * Modal para "Ampliar plazo" a todos los alumnos de una tarea.
 * Reemplaza el window.prompt: deja elegir los días con atajos o a mano,
 * muestra la nueva fecha límite antes de confirmar y permite escribir un
 * motivo opcional. El cálculo real lo hace el backend (hoy + N días, 23:59).
 */
const ExtendDeadlineModal = ({ task, onConfirm, onClose, saving = false }) => {
  const [days, setDays] = useState('3');
  const [reason, setReason] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    // Foco en el número para poder escribir y dar Enter directamente.
    const t = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(t);
  }, []);

  const parsed = parseInt(days, 10);
  const isValid = Number.isInteger(parsed) && parsed >= MIN_DAYS && parsed <= MAX_DAYS;

  const newDeadline = useMemo(
    () => (isValid ? addDays(new Date(), parsed) : null),
    [isValid, parsed],
  );

  const studentCount = task?.assigned_students_data?.length || (task?.assigned_to ? 1 : 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    onConfirm({
      days: parsed,
      reason: reason.trim() || `Plazo ampliado ${parsed} día(s)`,
    });
  };

  return (
    <Modal title="Ampliar plazo" onClose={saving ? () => {} : onClose} size="small" zIndex={10050}>
      <form className="extend-deadline-form" onSubmit={handleSubmit}>
        <p className="extend-deadline-intro">
          <FiUsers aria-hidden="true" />
          <span>
            Se dará más tiempo a <strong>todos los alumnos</strong>
            {studentCount > 0 && <> ({studentCount})</>} sin editar la fecha original de la tarea.
          </span>
        </p>

        <fieldset className="extend-deadline-field">
          <legend>Días adicionales</legend>
          <div className="extend-deadline-chips" role="group" aria-label="Atajos de días">
            {QUICK_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                className={`extend-chip ${parsed === d ? 'active' : ''}`}
                onClick={() => setDays(String(d))}
                disabled={saving}
              >
                {d} {d === 1 ? 'día' : 'días'}
              </button>
            ))}
          </div>
          <div className="extend-deadline-input">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min={MIN_DAYS}
              max={MAX_DAYS}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              disabled={saving}
              aria-invalid={!isValid}
              aria-describedby="extend-deadline-hint"
            />
            <span>días a partir de hoy</span>
          </div>
          {!isValid && days !== '' && (
            <small id="extend-deadline-hint" className="extend-deadline-error">
              Indica un número entre {MIN_DAYS} y {MAX_DAYS}.
            </small>
          )}
        </fieldset>

        <div className={`extend-deadline-preview ${isValid ? '' : 'is-empty'}`}>
          <FiCalendar aria-hidden="true" />
          <div>
            <span className="label">Nueva fecha límite</span>
            <strong>
              {newDeadline
                ? `${format(newDeadline, "EEEE d 'de' MMMM yyyy", { locale: es })} a las 23:59`
                : '—'}
            </strong>
          </div>
        </div>

        <label className="extend-deadline-field">
          <span className="legend">Motivo <em>(opcional)</em></span>
          <textarea
            rows={2}
            maxLength={250}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Se cayó la plataforma el fin de semana"
            disabled={saving}
          />
        </label>

        <div className="extend-deadline-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-warning btn-icon" disabled={!isValid || saving}>
            <FiRotateCw className={saving ? 'spinning' : ''} />
            {saving ? 'Guardando...' : 'Ampliar plazo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ExtendDeadlineModal;
