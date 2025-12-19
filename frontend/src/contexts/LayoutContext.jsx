import { createContext, useState } from 'react';
import PropTypes from 'prop-types';

export const LayoutContext = createContext();

export const LayoutProvider = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <LayoutContext.Provider
      value={{
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isSidebarOpen,
        setIsSidebarOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
};

LayoutProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
