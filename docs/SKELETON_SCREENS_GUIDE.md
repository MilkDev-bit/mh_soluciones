# Skeleton Screens Usage Guide

## Overview
Skeleton screens provide visual feedback during data loading, improving perceived performance and user experience.

## Available Components

### 1. ActivitySkeleton
**Location**: `frontend/src/components/skeletons/ActivitySkeleton.jsx`

**Usage**:
```javascript
import ActivitySkeleton from '../components/skeletons/ActivitySkeleton';

if (isLoading) return <ActivitySkeleton />;
```

**Displays**: 5 activity items with shimmer effect

### 2. DashboardSkeleton
**Location**: `frontend/src/components/skeletons/DashboardSkeleton.jsx`

**Usage**:
```javascript
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';

if (isLoading) return <DashboardSkeleton />;
```

**Displays**: 6 dashboard cards in responsive grid

### 3. TableSkeleton
**Location**: `frontend/src/components/skeletons/TableSkeleton.jsx`

**Usage**:
```javascript
import TableSkeleton from '../components/skeletons/TableSkeleton';

// Default: 5 rows, 4 columns
if (isLoading) return <TableSkeleton />;

// Custom: 10 rows, 6 columns
if (isLoading) return <TableSkeleton rows={10} columns={6} />;
```

**Props**:
- `rows` (number): Number of rows to display (default: 5)
- `columns` (number): Number of columns to display (default: 4)

### 4. ListSkeleton
**Location**: `frontend/src/components/skeletons/ListSkeleton.jsx`

**Usage**:
```javascript
import ListSkeleton from '../components/skeletons/ListSkeleton';

// Default: 8 items
if (isLoading) return <ListSkeleton />;

// Custom: 15 items
if (isLoading) return <ListSkeleton items={15} />;
```

**Props**:
- `items` (number): Number of list items to display (default: 8)

## Creating Custom Skeletons

### Basic Pattern
```javascript
import './Skeleton.scss';

const CustomSkeleton = () => {
  return (
    <div className="custom-skeleton">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="skeleton-item">
          <div className="skeleton-title skeleton-shimmer"></div>
          <div className="skeleton-content skeleton-shimmer"></div>
        </div>
      ))}
    </div>
  );
};

export default CustomSkeleton;
```

### Styling
Use the `skeleton-shimmer` class for animated shimmer effect:

```scss
.custom-skeleton {
  .skeleton-item {
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .skeleton-title {
    height: 24px;
    width: 60%;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .skeleton-content {
    height: 16px;
    width: 90%;
    border-radius: 4px;
  }
}
```

## Best Practices

### 1. Match Content Layout
Skeleton should resemble actual content:

```javascript
// ✅ Good - Matches actual card layout
<div className="skeleton-card">
  <div className="skeleton-avatar skeleton-shimmer"></div>
  <div className="skeleton-title skeleton-shimmer"></div>
  <div className="skeleton-description skeleton-shimmer"></div>
</div>

// ❌ Bad - Generic squares
<div className="skeleton-generic">
  <div className="skeleton-box skeleton-shimmer"></div>
  <div className="skeleton-box skeleton-shimmer"></div>
</div>
```

### 2. Use Appropriate Count
Show realistic number of items:

```javascript
// ✅ Good - Realistic count for viewport
<ListSkeleton items={8} />

// ❌ Bad - Too many items
<ListSkeleton items={100} />
```

### 3. Consistent Sizing
Match skeleton size to actual content:

```scss
// ✅ Good - Matches actual content height
.skeleton-card {
  height: 200px; // Same as actual card
}

// ❌ Bad - Different from actual content
.skeleton-card {
  height: 50px; // Actual card is 200px
}
```

### 4. Smooth Transitions
Prevent layout shift when content loads:

```javascript
const MyComponent = () => {
  const { data, isLoading } = useQuery({...});

  // Both skeleton and content in same container
  return (
    <div className="content-container">
      {isLoading ? <ActivitySkeleton /> : <ActivityList data={data} />}
    </div>
  );
};
```

## Common Patterns

### Page with Multiple Sections
```javascript
const DashboardPage = () => {
  const { data, isLoading } = useQuery({...});

  if (isLoading) {
    return (
      <div className="dashboard">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="dashboard">
      <StatsCards data={data.stats} />
      <RecentActivity data={data.activity} />
    </div>
  );
};
```

### Table with Loading
```javascript
const DataTable = () => {
  const { data, isLoading } = useQuery({...});

  return (
    <div className="table-container">
      {isLoading ? (
        <TableSkeleton rows={10} columns={5} />
      ) : (
        <table>
          {data.map(row => <TableRow key={row.id} data={row} />)}
        </table>
      )}
    </div>
  );
};
```

### List with Pagination
```javascript
const PaginatedList = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['items', page],
    queryFn: () => getItems(page),
  });

  return (
    <div>
      {isLoading ? (
        <ListSkeleton items={10} />
      ) : (
        <ItemList items={data.items} />
      )}
      <Pagination page={page} onChange={setPage} />
    </div>
  );
};
```

## Animation Details

The shimmer effect is created using CSS:

```scss
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

## Accessibility

Skeleton screens are decorative and should not be announced by screen readers:

```javascript
<div className="skeleton-container" aria-hidden="true">
  <ActivitySkeleton />
</div>
```

For screen reader users, provide status messages:

```javascript
const MyComponent = () => {
  const { data, isLoading } = useQuery({...});

  return (
    <>
      {isLoading && <span className="sr-only">Cargando datos...</span>}
      <div className="content">
        {isLoading ? <ActivitySkeleton /> : <ActivityList data={data} />}
      </div>
    </>
  );
};
```

## Performance Considerations

### 1. Limit Skeleton Count
Don't render too many skeleton items:

```javascript
// ✅ Good - Reasonable count
<ListSkeleton items={10} />

// ❌ Bad - Too many (causes performance issues)
<ListSkeleton items={1000} />
```

### 2. Use CSS Animations
Prefer CSS animations over JS:

```scss
// ✅ Good - CSS animation
.skeleton-shimmer {
  animation: shimmer 1.5s infinite;
}

// ❌ Bad - JS animation
setInterval(() => updatePosition(), 16);
```

### 3. Memoize Skeleton Components
For complex skeletons:

```javascript
import { memo } from 'react';

const ComplexSkeleton = memo(() => {
  return (
    // Complex skeleton structure
  );
});
```

## Testing

When testing components with skeletons:

```javascript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

test('shows skeleton while loading', async () => {
  const queryClient = new QueryClient();
  
  render(
    <QueryClientProvider client={queryClient}>
      <MyComponent />
    </QueryClientProvider>
  );

  // Check for skeleton
  expect(screen.getByLabelText('Cargando datos...')).toBeInTheDocument();
  
  // Wait for content
  await waitFor(() => {
    expect(screen.getByText('Actual Content')).toBeInTheDocument();
  });
});
```

## Migration Checklist

When adding skeletons to existing pages:

- [ ] Identify loading states in component
- [ ] Choose appropriate skeleton component
- [ ] Match skeleton layout to actual content
- [ ] Replace generic spinner with skeleton
- [ ] Test loading → loaded transition
- [ ] Verify no layout shift occurs
- [ ] Add accessibility labels
- [ ] Test on different screen sizes

## Examples in Codebase

| Page | Skeleton Used | Location |
|------|---------------|----------|
| Activity | ActivitySkeleton | `src/pages/ActividadPage.jsx` |
| Dashboard | DashboardSkeleton | `src/pages/DashboardPage.jsx` |
| Reports | DashboardSkeleton | `src/pages/ReportesPage.jsx` |

## Need More?

If you need a new skeleton variant:
1. Create component in `src/components/skeletons/`
2. Import shared `Skeleton.scss`
3. Use `skeleton-shimmer` class for animation
4. Match layout to actual content
5. Document usage in this guide
