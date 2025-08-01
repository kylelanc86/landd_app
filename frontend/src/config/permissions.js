// Define all available permissions
export const PERMISSIONS = {
  // Project permissions
  'projects.view': 'View projects',
  'projects.create': 'Create projects',
  'projects.edit': 'Edit projects',
  'projects.delete': 'Delete projects',
  'projects.change_status': 'Change project status',
  
  // User permissions
  'users.view': 'View users',
  'users.create': 'Create new users',
  'users.delete': 'Delete users',
  
  // Other restricted permissions
  'invoices.approve': 'Approve invoices',
  'timesheets.approve': 'Approve timesheets',
  'xero.sync': 'Sync with Xero',

  // Admin permissions
  'admin.view': 'Access admin features',
  'admin.create': 'Create admin resources',
  'admin.update': 'Update admin resources',
  'admin.delete': 'Delete admin resources',
};

// Define role-based permissions
export const ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS), // Admins have all restricted permissions
  manager: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.change_status',
    'users.view',
    'invoices.approve',
    'timesheets.approve',
    'xero.sync',
  ],
  employee: [
    'projects.view',
    'projects.create',
    'projects.edit',
  ], // Employees can view, create and edit projects but not change status
};

// Helper functions to check permissions
export const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  
  // If the permission is not in PERMISSIONS, it's not restricted, so everyone has access
  if (!Object.keys(PERMISSIONS).includes(permission)) {
    return true;
  }
  
  // If the permission is restricted, check if the user's role has it
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return rolePermissions.includes(permission);
};

export const hasAnyPermission = (user, permissions) => {
  if (!user || !user.role) return false;
  
  // If any permission is not restricted, return true
  if (permissions.some(permission => !Object.keys(PERMISSIONS).includes(permission))) {
    return true;
  }
  
  // Check restricted permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.some(permission => rolePermissions.includes(permission));
};

export const hasAllPermissions = (user, permissions) => {
  if (!user || !user.role) return false;
  
  // If any permission is not restricted, return true
  if (permissions.some(permission => !Object.keys(PERMISSIONS).includes(permission))) {
    return true;
  }
  
  // Check restricted permissions
  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.every(permission => rolePermissions.includes(permission));
}; 