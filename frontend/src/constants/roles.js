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
  ADMIN_ROLES: ['SUPERADMIN', 'ADMIN', 'CEO'],
  
  // Roles that can manage projects and view student performance
  PROJECT_MANAGERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'DIRECTOR', 'PROFESSOR'],
  
  // Roles that can view student performance and project analytics
  ANALYTICS_VIEWERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'CLIENT', 'DIRECTOR', 'PROFESSOR'],
  
  // Roles that can access Google Drive folders
  DRIVE_ACCESS: ['SUPERADMIN', 'ADMIN', 'CEO', 'CLIENT'],
  
  // Roles that can submit project deliverables
  SUBMITTERS: ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR'],
  
  // Roles that can manage users
  USER_MANAGERS: ['SUPERADMIN', 'ADMIN', 'RH'],
  
  // Roles that can create tasks
  TASK_CREATORS: ['SUPERADMIN', 'ADMIN', 'CEO', 'DIRECTOR', 'PROFESSOR'],
  
  // Roles that can grade tasks
  TASK_GRADERS: ['SUPERADMIN', 'CEO', 'DIRECTOR', 'PROFESSOR'],
};

// Helper functions to check role membership
export const isAdmin = (role) => ROLE_GROUPS.ADMIN_ROLES.includes(role);
export const canManageProjects = (role) => ROLE_GROUPS.PROJECT_MANAGERS.includes(role);
export const canViewAnalytics = (role) => ROLE_GROUPS.ANALYTICS_VIEWERS.includes(role);
export const canAccessDrive = (role) => ROLE_GROUPS.DRIVE_ACCESS.includes(role);
export const canSubmit = (role) => ROLE_GROUPS.SUBMITTERS.includes(role);
export const canManageUsers = (role) => ROLE_GROUPS.USER_MANAGERS.includes(role);
export const canCreateTasks = (role) => ROLE_GROUPS.TASK_CREATORS.includes(role);
export const canGradeTasks = (role) => ROLE_GROUPS.TASK_GRADERS.includes(role);

// New helper functions for specific permissions
export const canEditUser = (userRole, targetRole) => {
  if (userRole === 'SUPERADMIN') return true;
  if (userRole === 'ADMIN' && targetRole !== 'SUPERADMIN') return true;
  if (userRole === 'RH' && !['SUPERADMIN', 'ADMIN', 'CEO'].includes(targetRole)) return true;
  return false;
};

export const canDeleteUser = (userRole, targetRole) => {
  if (userRole === 'SUPERADMIN') return true;
  if (userRole === 'ADMIN' && targetRole !== 'SUPERADMIN') return true;
  if (userRole === 'RH' && !['SUPERADMIN', 'ADMIN', 'CEO'].includes(targetRole)) return true;
  return false;
};

export const canViewReports = (role) => canViewAnalytics(role);

export const canExportData = (role) => ROLE_GROUPS.ANALYTICS_VIEWERS.includes(role);

export const isStudent = (role) => role === 'STUDENT';
export const isClient = (role) => role === 'CLIENT';
