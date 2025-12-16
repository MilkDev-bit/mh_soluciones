import './Skeleton.scss';

const ListSkeleton = ({ items = 8 }) => {
  return (
    <div className="list-skeleton">
      {[...Array(items)].map((_, index) => (
        <div key={index} className="skeleton-list-item skeleton-shimmer"></div>
      ))}
    </div>
  );
};

export default ListSkeleton;
