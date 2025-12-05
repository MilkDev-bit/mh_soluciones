import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

/**
 * Custom hook for optimistic updates with rollback capability
 * Prevents the need for full page reloads
 */
const useOptimisticUpdate = () => {
  const rollbackRef = useRef(null);

  /**
   * Performs an optimistic update with automatic rollback on failure
   * @param {Object} options - Configuration options
   * @param {Function} options.updateFn - Function to apply the optimistic update to state
   * @param {Function} options.apiCall - The API call to make
   * @param {Function} options.rollbackFn - Function to rollback the state on failure
   * @param {string} options.successMessage - Toast message on success
   * @param {string} options.errorMessage - Toast message on error
   * @returns {Promise} - Result of the API call
   */
  const optimisticUpdate = useCallback(async ({
    updateFn,
    apiCall,
    rollbackFn,
    successMessage,
    errorMessage = 'Ocurrió un error. Los cambios fueron revertidos.',
  }) => {
    // Store rollback function
    rollbackRef.current = rollbackFn;
    
    // Apply optimistic update immediately
    if (updateFn) {
      updateFn();
    }

    try {
      const result = await apiCall();
      
      if (successMessage) {
        toast.success(successMessage);
      }
      
      rollbackRef.current = null;
      return result;
    } catch (error) {
      // Rollback on error
      if (rollbackRef.current) {
        rollbackRef.current();
        rollbackRef.current = null;
      }
      
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  /**
   * Creates a handler for list item addition with optimistic update
   */
  const optimisticAdd = useCallback((setState, apiCall, successMessage) => {
    return async (newItem) => {
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = { ...newItem, id: tempId, _isOptimistic: true };
      
      setState(prev => [optimisticItem, ...prev]);
      
      try {
        const result = await apiCall(newItem);
        setState(prev => prev.map(item => 
          item.id === tempId ? result : item
        ));
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (error) {
        setState(prev => prev.filter(item => item.id !== tempId));
        throw error;
      }
    };
  }, []);

  /**
   * Creates a handler for list item update with optimistic update
   */
  const optimisticUpdate2 = useCallback((setState, apiCall, successMessage) => {
    return async (itemId, updates) => {
      let originalItem = null;
      
      setState(prev => prev.map(item => {
        if (item.id === itemId) {
          originalItem = { ...item };
          return { ...item, ...updates, _isOptimistic: true };
        }
        return item;
      }));
      
      try {
        const result = await apiCall(itemId, updates);
        setState(prev => prev.map(item => 
          item.id === itemId ? result : item
        ));
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (error) {
        if (originalItem) {
          setState(prev => prev.map(item => 
            item.id === itemId ? originalItem : item
          ));
        }
        throw error;
      }
    };
  }, []);

  /**
   * Creates a handler for list item deletion with optimistic update
   */
  const optimisticDelete = useCallback((setState, apiCall, successMessage) => {
    return async (itemId) => {
      let deletedItem = null;
      let deletedIndex = -1;
      
      setState(prev => {
        const index = prev.findIndex(item => item.id === itemId);
        if (index !== -1) {
          deletedItem = prev[index];
          deletedIndex = index;
        }
        return prev.filter(item => item.id !== itemId);
      });
      
      try {
        await apiCall(itemId);
        if (successMessage) toast.success(successMessage);
      } catch (error) {
        if (deletedItem !== null) {
          setState(prev => {
            const newArr = [...prev];
            newArr.splice(deletedIndex, 0, deletedItem);
            return newArr;
          });
        }
        throw error;
      }
    };
  }, []);

  return {
    optimisticUpdate,
    optimisticAdd,
    optimisticUpdate: optimisticUpdate2,
    optimisticDelete,
  };
};

export default useOptimisticUpdate;
