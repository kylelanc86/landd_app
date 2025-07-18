# Invoice Sync Filtering Configuration

## Overview

The Xero invoice sync now includes configurable filtering to ensure only the documents you want are synced. By default, it will only sync **actual invoices** (not bills, drafts, or other document types).

## Current Configuration

The sync is configured to include:

### ✅ **Included Documents:**
- **ACCREC** (Accounts Receivable) invoices only
  - These are the invoices you send TO your customers
  - These are the invoices you want to track for payment

### ❌ **Excluded Documents:**
- **ACCPAY** (Accounts Payable) bills
  - These are bills you receive FROM suppliers
  - These are not customer invoices
- **DRAFT** invoices
  - Invoices that haven't been sent yet
- **DELETED** invoices
  - Invoices that have been deleted in Xero
- **VOIDED** invoices
  - Invoices that have been voided/cancelled
- Documents with keywords in reference: "expense", "claim", "bill"

## Configuration Options

You can modify the filtering by editing the `SYNC_CONFIG` object in `backend/services/xeroService.js`:

```javascript
const SYNC_CONFIG = {
  // Document types to include
  includeTypes: ['ACCREC'], // Only Accounts Receivable invoices
  
  // Statuses to exclude
  excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED'],
  
  // Keywords in reference field to exclude
  excludeReferenceKeywords: ['expense', 'claim', 'bill'],
  
  // Include draft invoices (set to true if you want drafts)
  includeDrafts: false,
  
  // Include deleted invoices (set to true if you want deleted)
  includeDeleted: false,
  
  // Include voided invoices (set to true if you want voided)
  includeVoided: false
};
```

## Common Scenarios

### 1. **Only Customer Invoices (Current Default)**
```javascript
includeTypes: ['ACCREC'],
excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED'],
includeDrafts: false,
includeDeleted: false,
includeVoided: false
```

### 2. **Include Draft Invoices**
```javascript
includeTypes: ['ACCREC'],
excludeStatuses: ['DELETED', 'VOIDED'], // Remove 'DRAFT' from excludeStatuses
includeDrafts: true,
includeDeleted: false,
includeVoided: false
```

### 3. **Include Both Customer Invoices and Bills**
```javascript
includeTypes: ['ACCREC', 'ACCPAY'], // Add ACCPAY for bills
excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED'],
includeDrafts: false,
includeDeleted: false,
includeVoided: false
```

### 4. **Include All Document Types**
```javascript
includeTypes: ['ACCREC', 'ACCPAY'],
excludeStatuses: [], // Empty array = no exclusions
includeDrafts: true,
includeDeleted: true,
includeVoided: true
```

## Xero Document Types Explained

- **ACCREC** = Accounts Receivable (Invoices you send TO customers)
- **ACCPAY** = Accounts Payable (Bills you receive FROM suppliers)

## Xero Status Types Explained

- **DRAFT** = Invoice created but not sent
- **SUBMITTED** = Invoice sent to customer
- **AUTHORISED** = Invoice approved/authorized
- **PAID** = Invoice has been paid
- **VOIDED** = Invoice cancelled/voided
- **DELETED** = Invoice deleted

## Testing Your Configuration

1. **Check the logs** during sync to see what's being filtered:
   ```
   Evaluating document: { id: '...', type: 'ACCREC', status: 'SUBMITTED', ... }
   Including invoice: INV-001 Status: SUBMITTED
   Skipping excluded status: DRAFT INV-002
   ```

2. **Monitor the summary**:
   ```
   Processing 15 valid invoices out of 45 total records
   Sync configuration: { includeTypes: ['ACCREC'], excludeStatuses: ['DRAFT', 'DELETED', 'VOIDED'], ... }
   ```

## Recommendations

For most businesses, the **current default configuration** is ideal:
- Only syncs customer invoices (ACCREC)
- Excludes drafts, deleted, and voided invoices
- Focuses on invoices that matter for your business

If you need to include drafts or other document types, you can easily modify the configuration without changing the core logic. 