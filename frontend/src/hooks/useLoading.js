import { useState, useCallback } from 'react';

/**
 * Custom hook for managing loading states with visual feedback
 * Provides consistent loading state management across the app
 */
const useLoading = (initialState = false) => {
  const [isLoading, setIsLoading] = useState(initialState);
  const [error, setError] = useState(null);

  const startLoading = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const stopLoading = useCallback(() => {
    setIsLoading(false);
  }, []);

  const setLoadingError = useCallback((err) => {
    setError(err);
    setIsLoading(false);
  }, []);

  /**
   * Wraps an async function with automatic loading state management
   * @param {Function} asyncFn - The async function to wrap
   * @param {Object} options - Options for customization
   * @returns {Function} - Wrapped function with loading state
   */
  const withLoading = useCallback((asyncFn, options = {}) => {
    return async (...args) => {
      const { onSuccess, onError, showError = true } = options;
      startLoading();
      try {
        const result = await asyncFn(...args);
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err) {
        if (showError) setLoadingError(err);
        if (onError) onError(err);
        throw err;
      } finally {
        stopLoading();
      }
    };
  }, [startLoading, stopLoading, setLoadingError]);

  return {
    isLoading,
    error,
    startLoading,
    stopLoading,
    setLoadingError,
    withLoading,
    setError,
  };
};

export default useLoading;
