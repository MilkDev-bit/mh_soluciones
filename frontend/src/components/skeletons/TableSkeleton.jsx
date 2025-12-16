import './Skeleton.scss';

const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="table-skeleton">
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table-row">
          {[...Array(columns)].map((_, colIndex) => (
            <div key={colIndex} className="skeleton-table-cell skeleton-shimmer"></div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default TableSkeleton;
