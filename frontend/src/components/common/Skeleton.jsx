import React from 'react';
import './Skeleton.scss';

const Skeleton = ({ 
  variant = 'text', 
  width = '100%', 
  height, 
  count = 1,
  circle = false,
  animation = 'pulse'
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);
  
  const getSkeletonStyle = () => {
    const style = { width };
    
    if (height) {
      style.height = height;
    } else {
      switch (variant) {
        case 'text':
          style.height = '1rem';
          break;
        case 'title':
          style.height = '2rem';
          break;
        case 'card':
          style.height = '200px';
          break;
        case 'avatar':
          style.height = '40px';
          style.width = '40px';
          break;
        case 'button':
          style.height = '40px';
          break;
        default:
          style.height = '1rem';
      }
    }
    
    if (circle) {
      style.borderRadius = '50%';
    }
    
    return style;
  };

  return (
    <div className="skeleton-wrapper">
      {skeletons.map((index) => (
        <div
          key={index}
          className={`skeleton skeleton-${variant} skeleton-${animation}`}
          style={getSkeletonStyle()}
        />
      ))}
    </div>
  );
};

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <Skeleton variant="title" width="70%" />
    <Skeleton variant="text" width="100%" count={3} />
    <div className="skeleton-card-footer">
      <Skeleton variant="avatar" circle />
      <Skeleton variant="text" width="40%" />
    </div>
  </div>
);

export const SkeletonList = ({ count = 5 }) => (
  <div className="skeleton-list">
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} />
    ))}
  </div>
);

export default Skeleton;
