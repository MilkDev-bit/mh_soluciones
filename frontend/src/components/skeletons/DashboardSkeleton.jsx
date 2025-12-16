import './Skeleton.scss';

const DashboardSkeleton = () => {
  return (
    <div className="dashboard-skeleton">
      {[...Array(6)].map((_, index) => (
        <div key={index} className="skeleton-card">
          <div className="skeleton-card-header skeleton-shimmer"></div>
          <div className="skeleton-card-content skeleton-shimmer"></div>
        </div>
      ))}
    </div>
  );
};

export default DashboardSkeleton;
