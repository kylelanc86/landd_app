# Air Monitoring Application - Permissions Summary

## Overview

The Air Monitoring Application uses a role-based access control (RBAC) system with three main roles: **Admin**, **Manager**, and **Employee**. Each role has specific permissions that determine what actions users can perform within the application.

## Role Hierarchy

1. **Admin** - Full system access with all permissions
2. **Manager** - Extended permissions for managing projects, users, and business operations
3. **Employee** - Basic permissions for day-to-day work activities

## Permission System Architecture

### Backend Implementation
- **File**: `backend/config/permissions.js`
- **Middleware**: `backend/middleware/checkPermission.js`
- **User Model**: `backend/models/User.js`

### Frontend Implementation
- **File**: `frontend/src/config/permissions.js`
- **Hook**: `frontend/src/hooks/usePermissions.js`

## Permission Categories

### 1. Project Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `projects.view` | View projects | ✅ | ✅ | ✅ |
| `projects.create` | Create projects | ✅ | ✅ | ✅ |
| `projects.edit` | Edit projects | ✅ | ✅ | ✅ |
| `projects.delete` | Delete projects | ✅ | ❌ | ❌ |
| `projects.change_status` | Change project status | ✅ | ✅ | ✅ |

### 2. User Management Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `users.view` | View users | ✅ | ✅ | ❌ |
| `users.create` | Create new users | ✅ | ❌ | ❌ |
| `users.edit` | Edit users | ✅ | ✅ | ❌ |
| `users.delete` | Delete users | ✅ | ✅ | ❌ |
| `users.manage` | Manage user accounts (password resets, etc.) | ✅ | ✅ | ❌ |

### 3. Job Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `jobs.view` | View jobs | ✅ | ✅ | ✅ |
| `jobs.create` | Create jobs | ✅ | ✅ | ✅ |
| `jobs.edit` | Edit jobs | ✅ | ✅ | ✅ |
| `jobs.delete` | Delete jobs | ✅ | ✅ | ❌ |
| `jobs.authorize_reports` | Authorize job reports | ✅ | ✅ | ❌ |

### 4. Calibration Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `calibrations.view` | View calibrations | ✅ | ✅ | ✅ |
| `calibrations.create` | Create calibrations | ✅ | ✅ | ✅ |
| `calibrations.edit` | Edit calibrations | ✅ | ✅ | ✅ |
| `calibrations.delete` | Delete calibrations | ✅ | ✅ | ❌ |

### 5. Equipment Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `equipment.view` | View equipment | ✅ | ✅ | ✅ |
| `equipment.create` | Create equipment | ✅ | ✅ | ✅ |
| `equipment.edit` | Edit equipment | ✅ | ✅ | ✅ |
| `equipment.delete` | Delete equipment | ✅ | ✅ | ❌ |

### 6. Asbestos Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `asbestos.view` | View asbestos data | ✅ | ✅ | ✅ |
| `asbestos.create` | Create asbestos records | ✅ | ✅ | ✅ |
| `asbestos.edit` | Edit asbestos records | ✅ | ✅ | ✅ |
| `asbestos.delete` | Delete asbestos records | ✅ | ✅ | ❌ |

### 7. Client Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `clients.view` | View clients | ✅ | ✅ | ✅ |
| `clients.create` | Create clients | ✅ | ✅ | ✅ |
| `clients.edit` | Edit clients | ✅ | ✅ | ✅ |
| `clients.delete` | Delete clients | ✅ | ✅ | ❌ |
| `clients.write_off` | Write off client accounts | ✅ | ✅ | ❌ |

### 8. Timesheet Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `timesheets.view` | View timesheets | ✅ | ✅ | ✅ |
| `timesheets.create` | Create timesheets | ✅ | ✅ | ✅ |
| `timesheets.edit` | Edit timesheets | ✅ | ✅ | ✅ |
| `timesheets.review` | Review timesheets | ✅ | ✅ | ❌ |
| `timesheets.approve` | Approve timesheets | ✅ | ✅ | ❌ |

### 9. Invoice Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `invoices.view` | View invoices | ✅ | ✅ | ✅ |
| `invoices.create` | Create invoices | ✅ | ✅ | ✅ |
| `invoices.edit` | Edit invoices | ✅ | ✅ | ✅ |
| `invoices.delete` | Delete invoices | ✅ | ✅ | ❌ |
| `invoices.approve` | Approve invoices | ✅ | ✅ | ❌ |
| `invoice_items.view` | View invoice items | ✅ | ✅ | ✅ |

### 10. Fibre ID Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `fibre.view` | View fibre ID data | ✅ | ✅ | ✅ |
| `fibre.create` | Create fibre ID records | ✅ | ✅ | ✅ |
| `fibre.edit` | Edit fibre ID records | ✅ | ✅ | ✅ |
| `fibre.delete` | Delete fibre ID records | ✅ | ✅ | ❌ |

### 11. Xero Integration Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `xero.sync` | Sync with Xero | ✅ | ✅ | ✅ |
| `xero.manage` | Manage Xero connection (connect/disconnect) | ✅ | ✅ | ❌ |

### 12. Admin Permissions
| Permission | Description | Admin | Manager | Employee |
|------------|-------------|-------|---------|----------|
| `admin.view` | Access admin features | ✅ | ❌ | ❌ |
| `admin.create` | Create admin resources | ✅ | ❌ | ❌ |
| `admin.update` | Update admin resources | ✅ | ❌ | ❌ |
| `admin.delete` | Delete admin resources | ✅ | ❌ | ❌ |

## Permission Implementation Details

### Backend Permission Checking

The backend uses middleware to check permissions on API routes:

```javascript
// Example usage in routes
router.get('/', auth, checkPermission(['projects.view']), async (req, res) => {
  // Route handler
});

router.post('/', auth, checkPermission(['projects.create']), async (req, res) => {
  // Route handler
});
```

### Frontend Permission Checking

The frontend uses a custom hook for permission checking:

```javascript
// Example usage in components
const { isAdmin, isManager, can } = usePermissions();

// Check specific permission
if (can('projects.delete')) {
  // Show delete button
}

// Check role-based access
if (isAdmin || isManager) {
  // Show admin/manager features
}
```

## Permission Helper Functions

### Backend
- `checkPermission(permissions, requireAll = false)` - Middleware for route protection
- `ROLE_PERMISSIONS` - Object defining permissions for each role
- `PERMISSIONS` - Object defining all available permissions

### Frontend
- `hasPermission(user, permission)` - Check if user has specific permission
- `hasAnyPermission(user, permissions)` - Check if user has any of the given permissions
- `hasAllPermissions(user, permissions)` - Check if user has all of the given permissions
- `usePermissions()` - React hook for permission checking

## Key Permission Patterns

### 1. CRUD Operations
Most entities follow a standard CRUD permission pattern:
- `*.view` - Read access
- `*.create` - Create access
- `*.edit` - Update access
- `*.delete` - Delete access

### 2. Special Operations
Some entities have additional permissions for special operations:
- `*.change_status` - Change status (projects)
- `*.approve` - Approval workflows (invoices, timesheets)
- `*.authorize_reports` - Report authorization (jobs)
- `*.manage` - Account management (users)

### 3. Integration Permissions
External integrations have specific permissions:
- `xero.sync` - Data synchronization
- `xero.manage` - Connection management

## Security Considerations

### 1. Backend Protection
- All sensitive routes are protected with `auth` middleware
- Permission checks are performed on every protected route
- Role-based permissions are enforced at the API level

### 2. Frontend Protection
- UI elements are conditionally rendered based on permissions
- Permission checks prevent unauthorized actions
- Role-based navigation and feature access

### 3. Data Access Control
- Users can only access data they have permission to view
- Create/Edit/Delete operations are restricted by role
- Admin functions are completely restricted to admin users

## Permission Management

### Adding New Permissions
1. Add permission to `PERMISSIONS` object in both backend and frontend
2. Assign permission to appropriate roles in `ROLE_PERMISSIONS`
3. Add permission checks to relevant routes
4. Update frontend components to use new permission

### Modifying Role Permissions
1. Update `ROLE_PERMISSIONS` object
2. Test permission changes thoroughly
3. Update documentation
4. Notify users of permission changes

## Common Permission Scenarios

### Admin User
- Full system access
- Can manage all users and permissions
- Can access admin-only features
- Can perform all CRUD operations

### Manager User
- Can manage projects and users
- Can approve invoices and timesheets
- Can delete most records
- Cannot access admin-only features

### Employee User
- Can view and edit most records
- Cannot delete records
- Cannot approve invoices/timesheets
- Cannot manage users
- Can sync with Xero using existing connection

## Notes

- All permissions are enforced at both backend and frontend levels
- Permission changes require application restart
- User roles are stored in the database and cannot be changed by regular users
- Admin users have access to all permissions automatically
- Non-restricted permissions (not in PERMISSIONS object) are available to all users
