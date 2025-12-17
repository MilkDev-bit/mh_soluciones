import '../skeletons/Skeleton.scss';

const UsersPageSkeleton = ({ viewMode = 'grid' }) => {
  return (
    <div className="users-page-skeleton">
      {/* Header Stats Skeleton */}
      <div className="users-stats-skeleton">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="stat-card-skeleton">
            <div className="skeleton-icon skeleton-shimmer"></div>
            <div className="skeleton-stat-content">
              <div className="skeleton-stat-title skeleton-shimmer"></div>
              <div className="skeleton-stat-value skeleton-shimmer"></div>
            </div>
          </div>
        ))}
      </div>

      {/* View Toggle Skeleton */}
      <div className="view-controls-skeleton">
        <div className="skeleton-search skeleton-shimmer"></div>
        <div className="skeleton-toggle skeleton-shimmer"></div>
      </div>

      {/* Content Skeleton */}
      {viewMode === 'grid' ? (
        <div className="users-grid-skeleton">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="user-card-skeleton">
              <div className="skeleton-avatar skeleton-shimmer"></div>
              <div className="skeleton-name skeleton-shimmer"></div>
              <div className="skeleton-username skeleton-shimmer"></div>
              <div className="skeleton-badges">
                <div className="skeleton-badge skeleton-shimmer"></div>
                <div className="skeleton-badge skeleton-shimmer"></div>
              </div>
              <div className="skeleton-actions">
                <div className="skeleton-action-btn skeleton-shimmer"></div>
                <div className="skeleton-action-btn skeleton-shimmer"></div>
                <div className="skeleton-action-btn skeleton-shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-skeleton">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="skeleton-table-row">
              <div className="skeleton-table-cell skeleton-shimmer"></div>
              <div className="skeleton-table-cell skeleton-shimmer"></div>
              <div className="skeleton-table-cell skeleton-shimmer"></div>
              <div className="skeleton-table-cell skeleton-shimmer"></div>
              <div className="skeleton-table-cell skeleton-shimmer"></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersPageSkeleton;
