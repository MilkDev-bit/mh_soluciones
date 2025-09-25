import React from 'react';
import './Common.scss';

const Loading = ({ fullscreen = false }) => {
  const loadingClass = fullscreen ? 'loading-overlay fullscreen' : 'loading-overlay';

  return (
    <div className={loadingClass}>
      <div className="spinner"></div>
    </div>
  );
};

export default Loading;