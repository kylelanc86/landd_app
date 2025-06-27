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
  'users.delete': 'Delete users',
  
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
  
  // Other restricted permissions
  'invoices.approve': 'Approve invoices',
  'timesheets.approve': 'Approve timesheets',
};

// Define role-based permissions
const ROLE_PERMISSIONS = {
  admin: Object.keys(PERMISSIONS), // Admins have all restricted permissions
  manager: [
    'projects.view',
    'projects.create',
    'projects.edit',
    'projects.change_status',
    'users.view',
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
  ], // Employees can view, create and edit projects but not change status
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
}; 