import React from 'react';
import './Dashboard.scss';

const StatsCard = ({ title, value, icon }) => {
  return (
    <div className="stat-card">
      <div className="stat-icon">
        {icon}
      </div>
      <div className="stat-content">
        <div className="stat-label">{title}</div>
        <div className="stat-value">{value}</div>
      </div>
    </div>
  );
};

export default StatsCard;