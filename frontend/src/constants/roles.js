// User roles constants
export const ROLES = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  CEO: 'CEO',
  RH: 'RH',
  DIRECTOR: 'DIRECTOR',
  PROFESSOR: 'PROFESSOR',
  STUDENT: 'STUDENT',
  CLIENT: 'CLIENT',
};

// Role groups for common permission checks
export const ROLE_GROUPS = {
  // Admin roles that have full access to most features
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH'],
  
  // Roles that can manage projects and view student performance
  PROJECT_MANAGERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'DIRECTOR', 'PROFESSOR'],
  
  // Roles that can view student performance and project analytics
  ANALYTICS_VIEWERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'CLIENT', 'DIRECTOR', 'PROFESSOR'],
  
  // Roles that can access Google Drive folders
  DRIVE_ACCESS: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'CLIENT'],
  
  // Roles that can submit project deliverables
  SUBMITTERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR', 'DIRECTOR'],
};

// Helper functions to check role membership
export const isAdmin = (role) => ROLE_GROUPS.ADMIN_ROLES.includes(role);
export const canManageProjects = (role) => ROLE_GROUPS.PROJECT_MANAGERS.includes(role);
export const canViewAnalytics = (role) => ROLE_GROUPS.ANALYTICS_VIEWERS.includes(role);
export const canAccessDrive = (role) => ROLE_GROUPS.DRIVE_ACCESS.includes(role);
export const canSubmit = (role) => ROLE_GROUPS.SUBMITTERS.includes(role);
