import React from 'react';
import './Dashboard.scss';

const StatsCard = ({ title, value, icon, color }) => {
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
};

export default StatsCard;