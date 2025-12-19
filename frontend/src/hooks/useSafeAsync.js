import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook que previene errores de setState en componentes desmontados
 * Uso:
 *   const safeAsync = useSafeAsync();
 *   safeAsync(async () => {
 *     const data = await fetchData();
 *     setState(data); // Safe - no se ejecutará si el componente se desmontó
 *   });
 */
export const useSafeAsync = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeAsync = useCallback(async (asyncFunction) => {
    try {
      const result = await asyncFunction();
      if (isMountedRef.current) {
        return result;
      }
      // Component unmounted after successful execution - return undefined
      return undefined;
    } catch (error) {
      if (isMountedRef.current) {
        throw error;
      }
      // Si el componente se desmontó, silenciar el error
      if (import.meta.env.DEV) {
        console.warn('Async operation completed after component unmount:', error);
      }
      return undefined;
    }
  }, []);

  return safeAsync;
};
