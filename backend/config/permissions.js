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
    'invoices.approve',
    'timesheets.approve',
  ],
  employee: [
    'projects.view',
    'projects.create',
    'projects.edit',
  ], // Employees can view, create and edit projects but not change status
};

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
}; 