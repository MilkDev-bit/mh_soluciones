import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';

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

  // Trigger projects update across all components
  const triggerProjectsUpdate = useCallback(() => {
    setProjectsUpdated(true);
    setLastUpdateTime(Date.now());
    // Dispatch custom event for components that may not have context access
    window.dispatchEvent(new CustomEvent('projectsUpdated'));
  }, []);

  // Trigger tasks update across all components
  const triggerTasksUpdate = useCallback((projectId = null) => {
    setTasksUpdated(true);
    setLastUpdateTime(Date.now());
    window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { projectId } }));
  }, []);

  // Mark updates as consumed
  const consumeProjectsUpdate = useCallback(() => {
    setProjectsUpdated(false);
  }, []);

  const consumeTasksUpdate = useCallback(() => {
    setTasksUpdated(false);
  }, []);

  // Notify when a specific project is updated
  const notifyProjectChange = useCallback((projectId, changeType = 'update') => {
    window.dispatchEvent(new CustomEvent('projectChanged', { 
      detail: { projectId, changeType, timestamp: Date.now() } 
    }));
    triggerProjectsUpdate();
  }, [triggerProjectsUpdate]);

  // Notify when a task is updated
  const notifyTaskChange = useCallback((taskId, projectId, changeType = 'update') => {
    window.dispatchEvent(new CustomEvent('taskChanged', { 
      detail: { taskId, projectId, changeType, timestamp: Date.now() } 
    }));
    triggerTasksUpdate(projectId);
  }, [triggerTasksUpdate]);

  // Subscribe to global updates
  const useProjectUpdateSubscription = (callback, deps = []) => {
    useEffect(() => {
      const handleUpdate = () => callback();
      window.addEventListener('projectsUpdated', handleUpdate);
      return () => window.removeEventListener('projectsUpdated', handleUpdate);
    }, deps);
  };

  const useTaskUpdateSubscription = (callback, projectId = null, deps = []) => {
    useEffect(() => {
      const handleUpdate = (e) => {
        if (!projectId || e.detail?.projectId === projectId) {
          callback(e.detail);
        }
      };
      window.addEventListener('tasksUpdated', handleUpdate);
      return () => window.removeEventListener('tasksUpdated', handleUpdate);
    }, [projectId, ...deps]);
  };

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