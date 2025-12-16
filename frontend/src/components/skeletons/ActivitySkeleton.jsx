import './Skeleton.scss';

const ActivitySkeleton = () => {
  return (
    <div className="activity-skeleton">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="skeleton-item">
          <div className="skeleton-icon skeleton-shimmer"></div>
          <div className="skeleton-content">
            <div className="skeleton-title skeleton-shimmer"></div>
            <div className="skeleton-description skeleton-shimmer"></div>
            <div className="skeleton-meta skeleton-shimmer"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivitySkeleton;
