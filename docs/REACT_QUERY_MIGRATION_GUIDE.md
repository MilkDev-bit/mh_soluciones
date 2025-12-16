# React Query Migration Guide

## Overview
This guide helps developers understand and work with the new React Query implementation in MH Solutions.

## What Changed

### Before (useEffect + useState)
```javascript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

### After (React Query)
```javascript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['resourceName'],
  queryFn: apiCall,
  staleTime: 60000, // 1 minute
});
```

## Benefits

1. **Automatic Caching**: Data is cached and reused across components
2. **Background Refetching**: Stale data is refreshed automatically
3. **Error Retry**: Built-in retry logic with exponential backoff
4. **Loading States**: Simplified loading state management
5. **Deduplication**: Multiple components requesting same data = one API call

## Usage Patterns

### Basic Query
```javascript
import { useQuery } from '@tanstack/react-query';

const MyComponent = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['todos'],
    queryFn: () => getTodos(),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay error={error} />;
  
  return <TodoList todos={data} />;
};
```

### Query with Parameters
```javascript
const { data } = useQuery({
  queryKey: ['todo', todoId], // Include params in key
  queryFn: () => getTodo(todoId),
  enabled: !!todoId, // Only run when todoId exists
});
```

### Dependent Queries
```javascript
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: getUser,
});

const { data: projects } = useQuery({
  queryKey: ['projects', user?.id],
  queryFn: () => getProjects(user.id),
  enabled: !!user?.id, // Wait for user first
});
```

### Manual Refetch
```javascript
const { data, refetch } = useQuery({
  queryKey: ['stats'],
  queryFn: getStats,
});

const handleRefresh = () => {
  refetch(); // Manual refetch
};
```

### Mutations (Create/Update/Delete)
```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';

const MyComponent = () => {
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });

  const handleCreate = (data) => {
    mutation.mutate(data);
  };

  return (
    <button onClick={() => handleCreate(newTodo)}>
      {mutation.isPending ? 'Creating...' : 'Create'}
    </button>
  );
};
```

## Configuration Options

### Global Defaults (in main.jsx)
```javascript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
```

### Per-Query Override
```javascript
useQuery({
  queryKey: ['realtime-data'],
  queryFn: getRealTimeData,
  staleTime: 0, // Always stale
  refetchInterval: 5000, // Poll every 5 seconds
});
```

## Common Patterns in MH Solutions

### Activity Page Pattern
```javascript
const { data: notificaciones = [], isLoading, error, refetch } = useQuery({
  queryKey: ['activities', filtroTipo],
  queryFn: async () => {
    return await getNotifications({ include_read: true, limit: 100 });
  },
  staleTime: 30000, // 30 seconds - frequent updates
  gcTime: 60000,
});
```

### Dashboard Pattern
```javascript
const { data, isLoading } = useQuery({
  queryKey: ['dashboard'],
  queryFn: getDashboardData,
  staleTime: 60000, // 1 minute - less frequent updates
});
```

### Statistics Pattern
```javascript
const [dateRange, setDateRange] = useState('30_dias');

const { data: estadisticas, isLoading } = useQuery({
  queryKey: ['statistics', dateRange],
  queryFn: () => getStatistics(dateRange),
  staleTime: 60000,
});
```

## DevTools

React Query DevTools are available in development mode:
- Toggle visibility with the floating button
- Inspect query states, cache, and mutations
- Debug stale/fresh data
- Monitor refetch behavior

## Best Practices

### 1. Query Keys
```javascript
// ✅ Good - Specific and descriptive
['todos', 'list', { status: 'active' }]
['todo', todoId]
['user', userId, 'projects']

// ❌ Bad - Too generic
['data']
['list']
```

### 2. Stale Time
```javascript
// Real-time data (notifications, chat)
staleTime: 0 // or 5000 (5s)

// Frequently changing (dashboard, stats)
staleTime: 30000 // 30s to 1min

// Rarely changing (user profile, settings)
staleTime: 300000 // 5min to 15min

// Static data (app config)
staleTime: Infinity
```

### 3. Loading States
```javascript
// ✅ Good - Use skeleton screens
if (isLoading) return <ActivitySkeleton />;

// ❌ Bad - Generic spinner
if (isLoading) return <div>Loading...</div>;
```

### 4. Error Handling
```javascript
// ✅ Good - User-friendly error
if (error) {
  return (
    <ErrorDisplay 
      message="No se pudieron cargar los datos" 
      onRetry={refetch}
    />
  );
}

// ❌ Bad - Raw error object
if (error) return <div>{error.message}</div>;
```

### 5. Optimistic Updates
```javascript
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    
    // Snapshot previous value
    const previousTodos = queryClient.getQueryData(['todos']);
    
    // Optimistically update
    queryClient.setQueryData(['todos'], old => [...old, newTodo]);
    
    return { previousTodos };
  },
  onError: (err, newTodo, context) => {
    // Rollback on error
    queryClient.setQueryData(['todos'], context.previousTodos);
  },
  onSettled: () => {
    // Refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

## Migration Checklist

When migrating a page to React Query:

- [ ] Install dependencies if not present
- [ ] Import useQuery/useMutation
- [ ] Remove useState for data/loading/error
- [ ] Remove useEffect for data fetching
- [ ] Define queryKey (specific and descriptive)
- [ ] Implement queryFn
- [ ] Set appropriate staleTime
- [ ] Replace loading spinner with skeleton screen
- [ ] Add error handling with retry option
- [ ] Test refetch behavior
- [ ] Verify cache invalidation for mutations
- [ ] Check DevTools for query state

## Troubleshooting

### Query not refetching
- Check `staleTime` - may be too long
- Verify `enabled` condition
- Ensure query key changes when params change

### Too many API calls
- Increase `staleTime`
- Set `refetchOnWindowFocus: false`
- Use `refetchInterval` carefully

### Stale data showing
- Decrease `staleTime`
- Use `refetch()` when needed
- Invalidate queries after mutations

### Memory leaks
- Check `gcTime` setting
- Don't store queries in refs
- Properly clean up on unmount

## Resources

- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)
- [Query Keys Guide](https://tanstack.com/query/latest/docs/react/guides/query-keys)
- [Mutations Guide](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [DevTools](https://tanstack.com/query/latest/docs/react/devtools)

## Need Help?

If you encounter issues:
1. Check DevTools for query state
2. Review this guide for patterns
3. Check console for errors
4. Ask in team chat for support
