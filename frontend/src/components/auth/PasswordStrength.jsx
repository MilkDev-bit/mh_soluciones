import React from 'react';
import './PasswordStrength.scss';

const PasswordStrength = ({ password }) => {
  const calculateStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '' };

    let score = 0;
    const checks = {
      length: pwd.length >= 12,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      numbers: /[0-9]/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]/.test(pwd),
    };

    // Calculate score
    score += checks.length ? 25 : 0;
    score += checks.uppercase ? 20 : 0;
    score += checks.lowercase ? 20 : 0;
    score += checks.numbers ? 20 : 0;
    score += checks.special ? 15 : 0;

    // Determine strength level
    let label = '';
    let color = '';
    
    if (score < 40) {
      label = 'Muy débil';
      color = '#dc3545';
    } else if (score < 60) {
      label = 'Débil';
      color = '#fd7e14';
    } else if (score < 80) {
      label = 'Buena';
      color = '#ffc107';
    } else if (score < 100) {
      label = 'Fuerte';
      color = '#28a745';
    } else {
      label = 'Muy fuerte';
      color = '#20c997';
    }

    return { score, label, color, checks };
  };

  const strength = calculateStrength(password);

  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="strength-meter">
        <div 
          className="strength-meter-fill" 
          style={{ 
            width: `${strength.score}%`,
            backgroundColor: strength.color
          }}
        />
      </div>
      <div className="strength-label" style={{ color: strength.color }}>
        {strength.label}
      </div>
      <div className="strength-requirements">
        <div className={strength.checks.length ? 'requirement met' : 'requirement'}>
          {strength.checks.length ? '✓' : '○'} Mínimo 12 caracteres
        </div>
        <div className={strength.checks.uppercase ? 'requirement met' : 'requirement'}>
          {strength.checks.uppercase ? '✓' : '○'} Una letra mayúscula
        </div>
        <div className={strength.checks.lowercase ? 'requirement met' : 'requirement'}>
          {strength.checks.lowercase ? '✓' : '○'} Una letra minúscula
        </div>
        <div className={strength.checks.numbers ? 'requirement met' : 'requirement'}>
          {strength.checks.numbers ? '✓' : '○'} Un número
        </div>
        <div className={strength.checks.special ? 'requirement met' : 'requirement'}>
          {strength.checks.special ? '✓' : '○'} Un carácter especial
        </div>
      </div>
    </div>
  );
};

export default PasswordStrength;
