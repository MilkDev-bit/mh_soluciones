import { useState } from 'react';
import toast from 'react-hot-toast';
import { FiShield, FiLogOut, FiCheck } from 'react-icons/fi';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { PRIVACY_NOTICE_VERSION } from '../../constants/privacyNotice';
import PrivacyNoticeContent from './PrivacyNoticeContent';
import './PrivacyNotice.scss';

/**
 * Pantalla que se muestra mientras el usuario no haya aceptado la versión
 * vigente del Aviso de Privacidad (primer inicio de sesión o aviso nuevo).
 * No se puede cerrar: solo aceptar o cerrar sesión. La aceptación se guarda
 * en el servidor (PrivacyConsent) con fecha, IP y navegador.
 */
const PrivacyNoticeGate = () => {
  const { user, logout, updateUserContext } = useAuth();
  const [checked, setChecked] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setReadToEnd(true);
  };

  const handleAccept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      await api.post('auth/privacy-notice/', { version: PRIVACY_NOTICE_VERSION });
      updateUserContext({ privacy_accepted: true });
      toast.success('Gracias. Aceptaste el Aviso de Privacidad.');
    } catch (error) {
      if (error?.response?.status === 409) {
        toast.error(error.response.data?.detail || 'El aviso cambió. Recargando…');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error('No se pudo guardar tu aceptación. Intenta de nuevo.');
      }
      setSaving(false);
    }
  };

  return (
    <div className="privacy-gate" role="dialog" aria-modal="true" aria-labelledby="privacy-gate-title">
      <div className="privacy-gate-card">
        <header className="privacy-gate-header">
          <FiShield aria-hidden="true" />
          <div>
            <h2 id="privacy-gate-title">Aviso de Privacidad</h2>
            <p>
              Hola{user?.first_name ? `, ${user.first_name}` : ''}. Antes de continuar, lee y acepta cómo
              tratamos tus datos personales.
            </p>
          </div>
        </header>

        <div className="privacy-gate-body" onScroll={handleScroll} tabIndex={0}>
          <PrivacyNoticeContent />
        </div>

        <footer className="privacy-gate-footer">
          <label className="privacy-gate-check">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={saving}
            />
            <span>He leído el Aviso de Privacidad y acepto el tratamiento de mis datos personales.</span>
          </label>
          {!readToEnd && <small className="privacy-gate-hint">Desplázate para leer el aviso completo.</small>}
          <div className="privacy-gate-actions">
            <button type="button" className="btn btn-secondary" onClick={logout} disabled={saving}>
              <FiLogOut /> Cerrar sesión
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAccept} disabled={!checked || saving}>
              <FiCheck /> {saving ? 'Guardando…' : 'Aceptar y continuar'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default PrivacyNoticeGate;
