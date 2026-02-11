import { memo } from 'react';
import './Dashboard.scss';

const StatsCard = memo(({ title, value, icon, color }) => {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>
      <div className="stat-content">
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-decoration"></div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if value or color changed
  return prevProps.value === nextProps.value &&
         prevProps.color === nextProps.color &&
         prevProps.title === nextProps.title;
});

StatsCard.displayName = 'StatsCard';

export default StatsCard;