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
  'users.edit': 'Edit users',
  'users.delete': 'Delete users',
  'users.manage': 'Manage user accounts (password resets, etc.)',
  
  // Job permissions
  'jobs.view': 'View jobs',
  'jobs.create': 'Create jobs',
  'jobs.edit': 'Edit jobs',
  'jobs.delete': 'Delete jobs',
  'jobs.authorize_reports': 'Authorize job reports',
  
  // Calibration permissions
  'calibrations.view': 'View calibrations',
  'calibrations.create': 'Create calibrations',
  'calibrations.edit': 'Edit calibrations',
  'calibrations.delete': 'Delete calibrations',
  
  // Equipment permissions
  'equipment.view': 'View equipment',
  'equipment.create': 'Create equipment',
  'equipment.edit': 'Edit equipment',
  'equipment.delete': 'Delete equipment',
  
  // Asbestos permissions
  'asbestos.view': 'View asbestos data',
  'asbestos.create': 'Create asbestos records',
  'asbestos.edit': 'Edit asbestos records',
  'asbestos.delete': 'Delete asbestos records',
  
  // Client permissions
  'clients.view': 'View clients',
  'clients.create': 'Create clients',
  'clients.edit': 'Edit clients',
  'clients.delete': 'Delete clients',
  
  // Timesheet permissions
  'timesheets.view': 'View timesheets',
  'timesheets.create': 'Create timesheets',
  'timesheets.edit': 'Edit timesheets',
  'timesheets.review': 'Review timesheets',
  'timesheets.approve': 'Approve timesheets',
  
  // Invoice permissions
  'invoices.view': 'View invoices',
  'invoices.create': 'Create invoices',
  'invoices.edit': 'Edit invoices',
  'invoices.delete': 'Delete invoices',
  'invoices.approve': 'Approve invoices',
  'invoice_items.view': 'View invoice items',
  
  // Client supplied job permissions
  'clientSup.view': 'View client supplied jobs',
  'clientSup.create': 'Create client supplied jobs',
  'clientSup.edit': 'Edit client supplied jobs',
  'clientSup.delete': 'Delete client supplied jobs',
  
  // Other restricted permissions
  'xero.sync': 'Sync with Xero',
  'xero.manage': 'Manage Xero connection (connect/disconnect)',
  'clients.write_off': 'Write off client accounts',

  // Admin permissions
  'admin.access': 'Access admin-only features',
  'admin.view': 'Access admin features',
  'admin.create': 'Create admin resources',
  'admin.update': 'Update admin resources',
  'admin.delete': 'Delete admin resources',
};

// Define role-based permissions
export const ROLE_PERMISSIONS = {
  super_admin: Object.keys(PERMISSIONS), // Super admins have same as admin
  admin: Object.keys(PERMISSIONS), // Admins have all restricted permissions
  manager: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.change_status',
    'users.view',
    'users.edit',
    'users.manage',
    'jobs.view',
    'jobs.create',
    'jobs.edit',
    'jobs.delete',
    'jobs.authorize_reports',
    'calibrations.view',
    'calibrations.create',
    'calibrations.edit',
    'calibrations.delete',
    'equipment.view',
    'equipment.create',
    'equipment.edit',
    'equipment.delete',
    'asbestos.view',
    'asbestos.create',
    'asbestos.edit',
    'asbestos.delete',
    'clients.view',
    'clients.create',
    'clients.edit',
    'clients.delete',
    'timesheets.view',
    'timesheets.create',
    'timesheets.edit',
    'timesheets.review',
    'timesheets.approve',
    'invoices.view',
    'invoices.create',
    'invoices.edit',
    'invoices.delete',
    'invoices.approve',
    'invoice_items.view', // Managers can view invoice items
    'clientSup.view',
    'clientSup.create',
    'clientSup.edit',
    'clientSup.delete',
    'xero.sync',
    'xero.manage',
    'clients.write_off',
  ],
  employee: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.change_status', // Employees can now change project statuses
    'jobs.view',
    'jobs.create',
    'jobs.edit',
    'calibrations.view',
    'calibrations.create',
    'calibrations.edit',
    'equipment.view',
    'equipment.create',
    'equipment.edit',
    'asbestos.view',
    'asbestos.create',
    'asbestos.edit',
    'clients.view',
    'clients.create',
    'clients.edit',
    'timesheets.view',
    'timesheets.create',
    'timesheets.edit',
    'invoices.view',
    'invoices.create',
    'invoices.edit',
    'invoice_items.view', // Employees can view invoice items for dropdown
    'clientSup.view',
    'clientSup.create',
    'clientSup.edit',
    'xero.sync', // Employees can sync invoices to and from Xero using existing connection
  ], // Employees can view, create and edit most records but not delete or approve
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