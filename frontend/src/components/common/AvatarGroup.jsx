import { useState } from 'react';
import './AvatarGroup.scss';

const AVATAR_COLORS = [
  '#f97316', // orange (primary)
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#ef4444', // red
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
];

const getInitials = (firstName, lastName) => {
  const first = (firstName || '').trim().charAt(0).toUpperCase();
  const last = (lastName || '').trim().charAt(0).toUpperCase();
  return first + last || '?';
};

const getColor = (index) => AVATAR_COLORS[index % AVATAR_COLORS.length];

const MAX_VISIBLE = 3;

const AvatarGroup = ({ students = [], size = 28 }) => {
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (!students || students.length === 0) return null;

  const visible = students.slice(0, MAX_VISIBLE);
  const overflow = students.length - MAX_VISIBLE;
  const hasOverflow = overflow > 0;

  const allNames = students
    .map(s => `${s.first_name || ''} ${s.last_name || ''}`.trim())
    .join(', ');

  return (
    <div
      className="avatar-group"
      style={{ '--avatar-size': `${size}px` }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      title={allNames}
    >
      {visible.map((student, index) => (
        <div
          key={student.id}
          className="avatar-circle"
          style={{
            backgroundColor: getColor(index),
            zIndex: MAX_VISIBLE - index,
          }}
          aria-label={`${student.first_name} ${student.last_name}`}
        >
          {getInitials(student.first_name, student.last_name)}
        </div>
      ))}

      {hasOverflow && (
        <div
          className="avatar-circle avatar-overflow"
          style={{ zIndex: 0 }}
          aria-label={`+${overflow} más`}
        >
          +{overflow}
        </div>
      )}

      {tooltipVisible && (
        <div className="avatar-tooltip">
          {students.map((s) => (
            <span key={s.id} className="avatar-tooltip-name">
              {`${s.first_name || ''} ${s.last_name || ''}`.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
