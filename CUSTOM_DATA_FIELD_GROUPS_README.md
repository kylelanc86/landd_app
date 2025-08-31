# Custom Data Field Groups - New Organized Structure

## Overview
This document explains the new organized structure for custom data fields that groups related fields together instead of storing them as isolated items.

## Problem with Old Structure
The previous `CustomDataField` model stored each field as a separate document:
```javascript
// Old structure - each field is isolated
{
  _id: ObjectId,
  type: 'project_status',
  text: 'In progress',
  isActiveStatus: true,
  statusColor: '#1976d2',
  isActive: true,
  createdBy: ObjectId,
  createdAt: Date
}
```

This made the database hard to understand because:
- Each field was isolated
- No logical grouping
- Difficult to see relationships
- Hard to maintain consistency

## New Grouped Structure
The new `CustomDataFieldGroup` model groups related fields together:

```javascript
// New structure - fields are grouped logically
{
  _id: ObjectId,
  name: 'Project Status Fields',
  description: 'Custom data fields for project statuses with workflow progression',
  type: 'project_status',
  fields: [
    {
      text: 'In progress',
      isActiveStatus: true,
      statusColor: '#1976d2',
      order: 0,
      isActive: true,
      createdBy: ObjectId,
      createdAt: Date
    },
    {
      text: 'Samples Submitted to Lab',
      isActiveStatus: true,
      statusColor: '#ff9800',
      order: 1,
      isActive: true,
      createdBy: ObjectId,
      createdAt: Date
    }
    // ... more fields
  ],
  isActive: true,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## Benefits of New Structure

### 1. **Logical Organization**
- Related fields are grouped together
- Easy to see all options for a specific type
- Clear relationships between fields

### 2. **Better Data Integrity**
- Fields can't exist without a group
- Consistent metadata across related fields
- Easier to maintain relationships

### 3. **Improved Performance**
- Single query gets all related fields
- Better indexing possibilities
- Reduced database calls

### 4. **Easier Management**
- Add/remove fields from a group
- Bulk operations on related fields
- Better validation and constraints

## Migration Process

### Step 1: Run Migration Script
```bash
cd backend/scripts
node migrateToCustomDataFieldGroups.js
```

This script:
- Reads existing `CustomDataField` documents
- Groups them by `type`
- Creates new `CustomDataFieldGroup` documents
- Preserves all existing data

### Step 2: Populate Default Groups
```bash
cd backend/scripts
node populateCustomDataFieldGroups.js
```

This script:
- Creates default project status group
- Sets up logical workflow order
- Assigns appropriate colors
- Establishes active/inactive statuses

### Step 3: Update Frontend
The frontend now uses:
- `useCustomDataFieldGroups` hook instead of `useProjectStatuses`
- `customDataFieldGroupService` instead of `customDataFieldService`
- Better organized data structure

## API Endpoints

### New Grouped Endpoints
- `GET /api/custom-data-field-groups` - Get all groups
- `GET /api/custom-data-field-groups/type/:type` - Get group by type
- `GET /api/custom-data-field-groups/project-statuses` - Get project statuses
- `GET /api/custom-data-field-groups/fields/:type` - Get fields by type
- `POST /api/custom-data-field-groups` - Create new group
- `PUT /api/custom-data-field-groups/:id` - Update group
- `DELETE /api/custom-data-field-groups/:id` - Delete group

### Legacy Endpoints (Still Available)
- `GET /api/custom-data-fields/project-statuses` - Still works for backward compatibility

## Frontend Usage

### Old Way (useProjectStatuses)
```javascript
const { activeStatuses, inactiveStatuses, statusColors } = useProjectStatuses();
```

### New Way (useCustomDataFieldGroups)
```javascript
const { groups, fields, loading, error } = useCustomDataFieldGroups('project_status');

// For project statuses specifically
const { groups: statusGroups } = useCustomDataFieldGroups('project_status');
const projectStatuses = statusGroups[0]?.fields || [];
```

## Data Structure Examples

### Project Status Group
```javascript
{
  name: 'Project Status Fields',
  type: 'project_status',
  fields: [
    { text: 'In progress', isActiveStatus: true, order: 0 },
    { text: 'Samples Submitted to Lab', isActiveStatus: true, order: 1 },
    { text: 'Lab Analysis Completed', isActiveStatus: true, order: 2 },
    { text: 'Report sent for review', isActiveStatus: true, order: 3 },
    { text: 'Ready for invoicing', isActiveStatus: true, order: 4 },
    { text: 'Invoice sent', isActiveStatus: true, order: 5 },
    { text: 'Invoiced - Awaiting Payment', isActiveStatus: true, order: 6 },
    { text: 'Job complete', isActiveStatus: false, order: 7 },
    { text: 'On hold', isActiveStatus: false, order: 8 },
    { text: 'Quote sent', isActiveStatus: false, order: 9 },
    { text: 'Cancelled', isActiveStatus: false, order: 10 }
  ]
}
```

### Asbestos Removalist Group
```javascript
{
  name: 'Asbestos Removalist Fields',
  type: 'asbestos_removalist',
  fields: [
    { text: 'Company A', isActive: true, order: 0 },
    { text: 'Company B', isActive: true, order: 1 },
    { text: 'Company C', isActive: false, order: 2 }
  ]
}
```

## Backward Compatibility
- Existing `CustomDataField` documents remain unchanged
- Old API endpoints still work
- Frontend can gradually migrate to new structure
- No breaking changes to existing functionality

## Next Steps
1. **Run migration scripts** to populate new structure
2. **Update frontend components** to use new hooks and services
3. **Test thoroughly** to ensure status selection works
4. **Monitor performance** improvements
5. **Consider migrating other custom data field types** to grouped structure

## Troubleshooting

### Status Field Still Not Working
If the status field is still not working after migration:
1. Check that migration scripts ran successfully
2. Verify new API endpoints are accessible
3. Check browser console for errors
4. Ensure frontend is using new services

### Migration Errors
If migration fails:
1. Check MongoDB connection
2. Verify all models are properly imported
3. Check for duplicate data conflicts
4. Review error logs for specific issues

## Support
For issues with the new structure:
1. Check this README first
2. Review migration script logs
3. Check API endpoint responses
4. Verify database structure in MongoDB
