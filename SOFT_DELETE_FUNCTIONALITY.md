# Invoice Soft Delete Functionality

## Overview

The invoice system now supports **soft delete** functionality, which allows you to remove invoices from your app without affecting them in Xero. This is the safest approach for managing invoices.

## How It Works

### ✅ **What Happens When You "Delete" an Invoice:**

1. **Invoice is marked as deleted** in your app's database
2. **Invoice remains in Xero** completely unchanged
3. **Invoice disappears from your app's interface**
4. **Invoice can be restored later** if needed
5. **All data is preserved** for audit purposes

### ❌ **What Does NOT Happen:**

- Invoice is NOT deleted from Xero
- Invoice is NOT permanently removed from your database
- No data is lost

## Available Actions

### 1. **Soft Delete (Recommended)**
- **Route**: `DELETE /api/invoices/:id`
- **Frontend**: Click the red delete button in the invoice table
- **Behavior**: Marks invoice as deleted but keeps it in database
- **Reversible**: Yes, can be restored

### 2. **Hard Delete (Limited)**
- **Route**: `DELETE /api/invoices/:id/hard`
- **Behavior**: Completely removes invoice from database
- **Restriction**: Cannot hard delete Xero invoices (for safety)
- **Reversible**: No, permanent deletion

### 3. **Restore Deleted Invoice**
- **Route**: `POST /api/invoices/:id/restore`
- **Behavior**: Restores a soft-deleted invoice
- **Result**: Invoice reappears in your app

### 4. **View Deleted Invoices**
- **Route**: `GET /api/invoices/deleted/all`
- **Behavior**: Lists all soft-deleted invoices
- **Use Case**: Audit trail and recovery

## Database Schema Changes

The Invoice model now includes these fields:

```javascript
{
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deleteReason: {
    type: String,
    trim: true
  },
  deletedAt: {
    type: Date
  }
}
```

## Automatic Filtering

The system automatically filters out deleted invoices from:
- Invoice lists
- Search results
- Dashboard displays
- All normal queries

## API Endpoints

### Soft Delete an Invoice
```http
DELETE /api/invoices/:id
Content-Type: application/json

{
  "reason": "Optional reason for deletion"
}
```

### Hard Delete an Invoice (Non-Xero only)
```http
DELETE /api/invoices/:id/hard
```

### Restore a Deleted Invoice
```http
POST /api/invoices/:id/restore
```

### Get All Deleted Invoices
```http
GET /api/invoices/deleted/all
```

### Get Specific Deleted Invoice
```http
GET /api/invoices/deleted/:id
```

## Frontend Integration

### Delete Button
- Added red delete button to invoice table
- Prompts for optional deletion reason
- Shows confirmation message
- Updates UI immediately

### Error Handling
- Prevents hard deletion of Xero invoices
- Shows appropriate error messages
- Graceful failure handling

## Use Cases

### 1. **Remove Unwanted Invoices**
- Remove invoices that shouldn't be in your app
- Keep them in Xero for accounting purposes
- Maintain clean app interface

### 2. **Temporary Removal**
- Hide invoices temporarily
- Restore them later if needed
- No data loss

### 3. **Audit Trail**
- Track what was removed and when
- Keep deletion reasons for reference
- Maintain compliance

### 4. **Xero Safety**
- Never accidentally delete Xero invoices
- Maintain data integrity
- Safe experimentation

## Best Practices

1. **Use Soft Delete by Default**: Always use the regular delete button (soft delete)
2. **Provide Reasons**: Give meaningful reasons when deleting invoices
3. **Review Deleted Items**: Periodically check deleted invoices
4. **Restore When Needed**: Don't hesitate to restore if you made a mistake
5. **Avoid Hard Delete**: Only use hard delete for non-Xero invoices when absolutely necessary

## Security Considerations

- **Authentication Required**: All delete operations require authentication
- **Xero Protection**: Xero invoices cannot be hard deleted
- **Audit Trail**: All deletions are logged with timestamps and reasons
- **Data Preservation**: No data is permanently lost with soft delete

## Migration Notes

- Existing invoices are not affected
- New `isDeleted` field defaults to `false`
- All existing queries automatically filter out deleted invoices
- No migration script needed

This implementation provides a safe, reversible way to manage invoices in your app while maintaining data integrity and Xero synchronization. 