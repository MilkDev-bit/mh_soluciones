import { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';

const ProjectContext = createContext();

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext debe ser usado dentro de un ProjectProvider');
  }
  return context;
};

export const ProjectProvider = ({ children }) => {
  const [projectsUpdated, setProjectsUpdated] = useState(false);
  const [tasksUpdated, setTasksUpdated] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const updateTimeoutRef = useRef(null);

  // Trigger projects update with debounce
  const triggerProjectsUpdate = useCallback(() => {
    clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      setProjectsUpdated(true);
      setLastUpdateTime(Date.now());
      // Only use the context event, no window.dispatchEvent to avoid duplicates
    }, 300); // Debounce of 300ms
  }, []);

  // Trigger tasks update with debounce
  const triggerTasksUpdate = useCallback((projectId = null) => {
    clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      setTasksUpdated(true);
      setLastUpdateTime(Date.now());
      if (projectId) setActiveProjectId(projectId);
    }, 300); // Debounce of 300ms
  }, []);

  // Mark updates as consumed
  const consumeProjectsUpdate = useCallback(() => {
    setProjectsUpdated(false);
  }, []);

  const consumeTasksUpdate = useCallback(() => {
    setTasksUpdated(false);
  }, []);

  // Notify when a specific project is updated
  const notifyProjectChange = useCallback((_projectId, _changeType = 'update') => {
    // Note: Removed window.dispatchEvent to avoid duplicate events
    triggerProjectsUpdate();
  }, [triggerProjectsUpdate]);

  // Notify when a task is updated
  const notifyTaskChange = useCallback((_taskId, projectId, _changeType = 'update') => {
    // Note: Removed window.dispatchEvent to avoid duplicate events
    triggerTasksUpdate(projectId);
  }, [triggerTasksUpdate]);

  // Subscribe to global updates (keeping for backward compatibility)
  const useProjectUpdateSubscription = (callback, deps = []) => {
    useEffect(() => {
      // Note: This hook is deprecated in favor of using projectsUpdated state directly
      // Kept for backward compatibility with existing code
      const handleUpdate = () => callback();
      window.addEventListener('projectsUpdated', handleUpdate);
      return () => window.removeEventListener('projectsUpdated', handleUpdate);
    }, deps);
  };

  const useTaskUpdateSubscription = (callback, projectId = null, deps = []) => {
    useEffect(() => {
      // Note: This hook is deprecated in favor of using tasksUpdated state directly
      // Kept for backward compatibility with existing code
      const handleUpdate = (e) => {
        if (!projectId || e.detail?.projectId === projectId) {
          callback(e.detail);
        }
      };
      window.addEventListener('tasksUpdated', handleUpdate);
      return () => window.removeEventListener('tasksUpdated', handleUpdate);
    }, [projectId, ...deps]);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const value = {
    // State
    projectsUpdated,
    tasksUpdated,
    lastUpdateTime,
    activeProjectId,
    
    // Setters
    setProjectsUpdated,
    setTasksUpdated,
    setActiveProjectId,
    
    // Actions
    triggerProjectsUpdate,
    triggerTasksUpdate,
    consumeProjectsUpdate,
    consumeTasksUpdate,
    notifyProjectChange,
    notifyTaskChange,
    
    // Hooks for subscription
    useProjectUpdateSubscription,
    useTaskUpdateSubscription,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export { ProjectContext };