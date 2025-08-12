# L&D Consulting App - Permissions System Summary

## Overview
This document provides a comprehensive overview of the permissions system implemented in the L&D Consulting App. The system uses role-based access control (RBAC) with granular permissions for different features and operations.

## Permission Structure

### Core Permission Categories

#### 1. Project Permissions
- `projects.view` - View projects
- `projects.create` - Create new projects
- `projects.edit` - Edit existing projects
- `projects.delete` - Delete projects
- `projects.change_status` - Change project status

#### 2. User Management Permissions
- `users.view` - View user list and details
- `users.create` - Create new users
- `users.edit` - Edit existing users
- `users.delete` - Delete users
- `users.manage` - Manage user accounts (password resets, etc.)

#### 3. Job Permissions
- `jobs.view` - View jobs
- `jobs.create` - Create new jobs
- `jobs.edit` - Edit existing jobs
- `jobs.delete` - Delete jobs
- `jobs.authorize_reports` - Authorize job reports

#### 4. Calibration Permissions
- `calibrations.view` - View calibrations
- `calibrations.create` - Create calibrations
- `calibrations.edit` - Edit calibrations
- `calibrations.delete` - Delete calibrations

#### 5. Equipment Permissions
- `equipment.view` - View equipment
- `equipment.create` - Create equipment
- `equipment.edit` - Edit equipment
- `equipment.delete` - Delete equipment

#### 6. Administrative Permissions
- `admin.view` - Access admin features
- `admin.create` - Create admin resources
- `admin.update` - Update admin resources
- `admin.delete` - Delete admin resources

#### 7. Business Process Permissions
- `invoices.approve` - Approve invoices
- `timesheets.approve` - Approve timesheets
- `xero.sync` - Sync with Xero accounting system

## Role-Based Access Control

### Admin Role
**Full Access**: Admins have access to ALL permissions in the system, including:
- Complete project management
- Full user management capabilities
- All job operations
- Equipment and calibration management
- Administrative functions
- Business process approvals
- Xero integration

### Manager Role
**Elevated Access**: Managers have significant permissions but with some restrictions:
- **Projects**: View, create, edit, and change status (no delete)
- **Users**: View, edit, and manage (no create/delete)
- **Jobs**: Full access including report authorization
- **Calibrations**: Full access
- **Equipment**: Full access
- **Business Processes**: Can approve invoices and timesheets
- **Integration**: Can sync with Xero

### Employee Role
**Limited Access**: Employees have basic operational permissions:
- **Projects**: View, create, and edit (no delete or status change)
- **Jobs**: View, create, and edit (no delete or report authorization)
- **Calibrations**: View, create, and edit (no delete)
- **Equipment**: View, create, and edit (no delete)
- **No Administrative Access**
- **No Business Process Approvals**

## Missing Permissions (Identified Issues)

### Asbestos-Related Permissions
The following permissions are referenced in the codebase but **NOT DEFINED** in the permissions configuration:

- `asbestos.view` - Used in asbestos clearance reports, removal jobs, and clearances
- `asbestos.create` - Used in asbestos clearance reports, removal jobs, and clearances  
- `asbestos.edit` - Used in asbestos clearance reports, removal jobs, and clearances
- `asbestos.delete` - Used in asbestos clearance reports, removal jobs, and clearances

**Impact**: These routes are currently accessible to all authenticated users since the permissions don't exist in the restricted permissions list.

## Implementation Details

### Backend Implementation
- **Middleware**: `checkPermission` middleware validates permissions on protected routes
- **Configuration**: Permissions defined in `backend/config/permissions.js`
- **Usage**: Applied to route handlers using `checkPermission(['permission.name'])`

### Frontend Implementation
- **Hook**: `usePermissions` hook provides permission checking utilities
- **Configuration**: Permissions defined in `frontend/src/config/permissions.js`
- **Direct Usage**: `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()` functions
- **Components**: `PermissionGate` and `PermissionRoute` components for conditional rendering

### Permission Checking Functions
- `hasPermission(user, permission)` - Check if user has specific permission
- `hasAnyPermission(user, permissions)` - Check if user has any of the given permissions
- `hasAllPermissions(user, permissions)` - Check if user has all of the given permissions

## Security Features

### Permission Validation
- **Backend**: All protected routes require authentication and permission validation
- **Frontend**: UI elements are conditionally rendered based on user permissions
- **Middleware**: Centralized permission checking prevents unauthorized access

### Role Hierarchy
- **Admin** > **Manager** > **Employee**
- Higher roles inherit permissions from lower roles
- Granular control over specific operations

### Token-Based Security
- JWT tokens for authentication
- Permission checks on every protected request
- Secure password reset system with admin controls

## Current Usage Examples

### Backend Route Protection
```javascript
// Example: Equipment routes
router.get("/", auth, checkPermission("equipment.view"), async (req, res) => { ... });
router.post("/", auth, checkPermission("equipment.create"), async (req, res) => { ... });
router.put("/:id", auth, checkPermission("equipment.edit"), async (req, res) => { ... });
router.delete("/:id", auth, checkPermission("equipment.delete"), async (req, res) => { ... });
```

### Frontend Permission Checking
```javascript
// Example: User management
import { hasPermission } from "../../config/permissions";

const canEditUsers = hasPermission(currentUser, "users.edit");
const canSyncXero = hasPermission(currentUser, "xero.sync");
```

## Recommendations

### 1. Fix Missing Permissions
Add the missing asbestos-related permissions to both backend and frontend configurations:

```javascript
// Add to PERMISSIONS object
'asbestos.view': 'View asbestos-related data',
'asbestos.create': 'Create asbestos-related records',
'asbestos.edit': 'Edit asbestos-related records',
'asbestos.delete': 'Delete asbestos-related records',

// Add to appropriate roles in ROLE_PERMISSIONS
```

### 2. Permission Consistency
Ensure backend and frontend permission configurations are synchronized to prevent access control inconsistencies.

### 3. Regular Auditing
Implement regular permission audits to ensure:
- All protected routes have appropriate permission checks
- Permission definitions match actual usage
- Role assignments are appropriate for business needs

### 4. Documentation Updates
Keep this document updated as new permissions are added or existing ones are modified.

## File Locations

### Backend
- **Permissions Config**: `backend/config/permissions.js`
- **Permission Middleware**: `backend/middleware/checkPermission.js`
- **Protected Routes**: Various files in `backend/routes/`

### Frontend  
- **Permissions Config**: `frontend/src/config/permissions.js`
- **Permission Hook**: `frontend/src/hooks/usePermissions.js`
- **Permission Components**: `frontend/src/components/PermissionGate.jsx`, `frontend/src/components/PermissionRoute.jsx`

---

*Last Updated: [Current Date]*
*Version: 1.0*
