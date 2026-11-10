import React from 'react';
import { FiClock, FiAlertTriangle, FiCheckCircle, FiInfo, FiXCircle } from 'react-icons/fi';
import { WINDOW_STATE, TONE_COLORS } from '../../utils/taskStatus';

const TONE_ICONS = {
  info: FiInfo,
  warning: FiAlertTriangle,
  danger: FiXCircle,
  success: FiCheckCircle,
};

/**
 * Aviso de plazo para el alumno. El texto viene del servidor (my_window.message),
 * así el alumno ve el MISMO mensaje que recibiría al intentar entregar:
 * "Vence el…", "Aún puedes entregar hasta el… (tardía)", "Tu entrega fue
 * devuelta, corrige hasta el…", "Venció y no acepta tardías: pide una prórroga".
 */
const DeadlineBanner = ({ window: w, compact = false }) => {
  if (!w) return null;
  const meta = WINDOW_STATE[w.state] || { label: w.state, tone: 'info' };
  const colors = TONE_COLORS[meta.tone];
  const Icon = TONE_ICONS[meta.tone] || FiClock;

  return (
    <div
      role={meta.tone === 'danger' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        gap: '0.6rem',
        alignItems: 'flex-start',
        padding: compact ? '0.5rem 0.75rem' : '0.75rem 1rem',
        margin: compact ? '0 0 0.75rem' : '0.75rem 0',
        borderRadius: 8,
        borderLeft: `4px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontSize: compact ? '0.85rem' : '0.92rem',
      }}
    >
      <Icon style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <strong>{meta.label}.</strong> {w.message}
      </div>
    </div>
  );
};

export default DeadlineBanner;
