import React, { createContext, useState, useContext } from 'react';

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

  const triggerProjectsUpdate = () => {
    setProjectsUpdated(true);
  };

  const value = {
    projectsUpdated,
    setProjectsUpdated,
    triggerProjectsUpdate
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export { ProjectContext };