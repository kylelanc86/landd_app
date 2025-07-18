# Invoice Workflow - Updated Functionality

## Overview

The invoice system now follows a specific workflow designed to work seamlessly with Xero:

1. **Display only UNPAID invoices** from Xero in the main table
2. **Create draft invoices** in the app
3. **Sync draft invoices TO Xero** (one-way sync from app to Xero)
4. **Hard delete functionality** with checkboxes and bulk operations

## Workflow Steps

### 1. **Viewing Invoices**
- **Main Table**: Shows only UNPAID invoices from Xero
- **Filter**: Automatically filters out paid invoices
- **Source**: All displayed invoices come from Xero sync

### 2. **Creating Draft Invoices**
- **Location**: Click "Add Invoice" button
- **Status**: Automatically set to "draft"
- **Storage**: Stored locally in your app database
- **Xero Status**: Not yet synced to Xero

### 3. **Syncing Drafts to Xero**
- **Button**: "Sync Drafts to Xero"
- **Action**: Creates draft invoices in Xero
- **Direction**: One-way sync from app TO Xero
- **Result**: Draft invoices appear in Xero's draft invoices table

### 4. **Managing Invoices**
- **Bulk Selection**: Use checkboxes to select multiple invoices
- **Bulk Delete**: "Delete (X)" button appears when invoices are selected
- **Hard Delete**: Completely removes invoices from app database
- **Xero Safety**: Invoices remain in Xero (only removed from app)

## Button Functions

### **"Add Invoice"**
- Creates a new draft invoice in your app
- Status automatically set to "draft"
- Not synced to Xero yet

### **"Connect to Xero"**
- Establishes connection to Xero
- Required before any Xero operations

### **"Sync from Xero"**
- Downloads UNPAID invoices from Xero
- Updates your app's invoice table
- Only syncs unpaid invoices (as requested)

### **"Sync Drafts to Xero"**
- Finds all draft invoices in your app
- Creates them as draft invoices in Xero
- Updates local invoices with Xero IDs
- Only syncs invoices that don't already have Xero IDs

### **"Delete (X)"**
- Appears when invoices are selected
- Shows count of selected invoices
- Hard deletes selected invoices from app
- Invoices remain in Xero

## Invoice Statuses

### **Draft**
- Created in your app
- Not yet synced to Xero
- Can be synced to Xero using "Sync Drafts to Xero"

### **Unpaid**
- Synced from Xero
- Displayed in main table
- Can be selected for deletion

### **Paid**
- Synced from Xero
- **NOT displayed** in main table (as requested)
- Filtered out automatically

## Database Schema

```javascript
{
  invoiceID: String,
  client: ObjectId,
  amount: Number,
  status: 'draft' | 'unpaid' | 'paid', // Default: 'draft'
  date: Date,
  dueDate: Date,
  description: String,
  xeroInvoiceId: String, // Set when synced to Xero
  xeroStatus: String,
  isDeleted: Boolean, // For soft delete (if needed)
  // ... other fields
}
```

## API Endpoints

### **Create Draft Invoice**
```http
POST /api/invoices
{
  "invoiceID": "INV-001",
  "client": "client_id",
  "amount": 1000.00,
  "status": "draft",
  "date": "2024-01-15",
  "dueDate": "2024-02-15",
  "description": "Invoice description"
}
```

### **Sync Drafts to Xero**
```http
POST /api/xero/create-invoice
{
  "invoiceID": "INV-001",
  "client": "xero_contact_id",
  "amount": 1000.00,
  "date": "2024-01-15",
  "dueDate": "2024-02-15",
  "description": "Invoice description"
}
```

### **Bulk Delete Invoices**
```http
DELETE /api/invoices/:id/hard
```

## Frontend Features

### **Checkbox Selection**
- Select individual invoices
- Select all invoices on current page
- Bulk operations on selected invoices

### **Bulk Delete Button**
- Appears when invoices are selected
- Shows count of selected invoices
- Confirmation dialog before deletion
- Hard deletes from app database

### **Status Filtering**
- Automatically shows only unpaid invoices
- Draft invoices created in app are separate
- Paid invoices are filtered out

## Use Cases

### **Creating New Invoices**
1. Click "Add Invoice"
2. Fill in invoice details
3. Save as draft in app
4. Click "Sync Drafts to Xero" when ready
5. Invoice appears in Xero as draft

### **Managing Existing Invoices**
1. View unpaid invoices from Xero
2. Select unwanted invoices using checkboxes
3. Click "Delete (X)" to remove from app
4. Invoices remain in Xero for accounting

### **Workflow Integration**
1. Create drafts in app for convenience
2. Sync to Xero when ready to send
3. Manage paid/unpaid status in Xero
4. Remove unwanted invoices from app view

## Benefits

- **Clean Interface**: Only shows relevant unpaid invoices
- **Safe Operations**: Xero data is never deleted
- **Flexible Creation**: Create drafts locally, sync when ready
- **Bulk Management**: Efficiently manage multiple invoices
- **Clear Workflow**: Distinct separation between app and Xero operations

This workflow provides a clean, efficient way to manage invoices while maintaining the integrity of your Xero accounting data. 