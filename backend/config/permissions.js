// Define all available permissions
const PERMISSIONS = {
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
  'asbestos.view': 'View asbestos clearances',
  'asbestos.create': 'Create asbestos clearances',
  'asbestos.edit': 'Edit asbestos clearances',
  'asbestos.delete': 'Delete asbestos clearances',
  
  // Other restricted permissions
  'invoices.approve': 'Approve invoices',
  'timesheets.approve': 'Approve timesheets',
  
  // Admin permissions
  'admin.view': 'Admin view access',
  'admin.create': 'Admin create access',
  'admin.update': 'Admin update access',
  'admin.delete': 'Admin delete access',
};

// Define role-based permissions
const ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS), // Admins have all permissions including admin.*
  manager: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.change_status',
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.manage',
    'jobs.view',
    'jobs.create',
    'jobs.edit',
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
    'invoices.approve',
    'timesheets.approve',
  ],
  employee: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'users.view',
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
    'asbestos.edit'
  ], // Employees can view, create and edit projects but not change status
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
}; 