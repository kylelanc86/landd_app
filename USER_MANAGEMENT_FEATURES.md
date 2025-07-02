# User Management - Licences and Signature Features

## Overview
This document describes the features added to the user management system for handling licences and user signatures.

## New Fields Added

### 1. Licences (`licences`)
- **Type**: Array of objects
- **Structure**: Each licence object contains:
  - `state`: String - The state where the licence is issued
  - `licenceNumber`: String - The licence number
  - `licenceType`: String - The type of licence (e.g., LAA, Lead Assessor, etc.)
- **Default**: Empty array `[]`
- **Validation**: All three fields (state, licenceNumber, and licenceType) are required for each licence

### 2. Signature (`signature`)
- **Type**: String (Base64 encoded image data URL)
- **Purpose**: Store user's digital signature for use in reports
- **Default**: Empty string `""`
- **File Types**: JPEG, JPG, PNG, GIF
- **Max Size**: 5MB
- **Auto-compression**: Images are automatically compressed to reduce storage size

## Database Schema Changes

### User Model Updates
```javascript
// New fields added to User schema
licences: {
  type: [{
    state: {
      type: String,
      required: true,
      trim: true
    },
    licenceNumber: {
      type: String,
      required: true,
      trim: true
    },
    licenceType: {
      type: String,
      required: true,
      trim: true
    }
  }],
  default: []
},
signature: {
  type: String,
  trim: true
}
```

## Frontend Features

### User Management Interface
1. **Licences Management**:
   - Add multiple licences per user
   - Remove individual licences
   - Edit existing licences
   - Validation ensures state, licence number, and licence type are provided

2. **Signature Upload**:
   - File upload with drag-and-drop support
   - Image preview
   - Automatic compression and validation
   - Support for multiple image formats

### Data Grid Display
- **Licences Column**: Shows all licences for each user in format "State: LicenceNumber (LicenceType)"
- **Signature Column**: Displays signature thumbnail or "No signature" message

## Backend API Changes

### Updated Endpoints
- `POST /users` - Now accepts `licences` and `signature` fields
- `PUT /users/:id` - Now accepts `licences` and `signature` fields for updates

### Request/Response Format
```javascript
// Create/Update User Request
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "role": "employee",
  "licences": [
    {
      "state": "NSW",
      "licenceNumber": "LAA123456",
      "licenceType": "LAA"
    },
    {
      "state": "VIC",
      "licenceNumber": "LA789012",
      "licenceType": "Lead Assessor"
    }
  ],
  "signature": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
}

// User Response
{
  "_id": "user_id",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "1234567890",
  "role": "employee",
  "licences": [...],
  "signature": "data:image/jpeg;base64,...",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Utility Functions

### Signature Utilities (`frontend/src/utils/signatureUtils.js`)
- `getUserSignature(userId, users)` - Get user's signature
- `getUserLicences(userId, users)` - Get user's licences
- `formatLicences(licences)` - Format licences for display
- `insertSignatureIntoPdf(signatureDataUrl, pdfDoc, x, y, width, height)` - Insert signature into PDF reports
- `validateSignatureFile(file)` - Validate uploaded signature files
- `compressSignatureImage(dataUrl, maxWidth, maxHeight, quality)` - Compress signature images

## Database Migration

### Migration Scripts
1. **Initial Migration** (for new installations):
   ```bash
   cd backend
   node scripts/addUserFields.js
   ```

2. **Migration from LAA Licences** (for existing installations):
   ```bash
   cd backend
   node scripts/migrateLaaLicencesToLicences.js
   ```

These scripts will:
- Add `licences: []` to all existing users
- Add `signature: ""` to all existing users
- Migrate existing `laaLicences` data to the new `licences` structure
- Add `licenceType: "LAA"` to existing licences
- Preserve all existing user data

## Usage in Reports

### Including Signatures in Reports
```javascript
import { getUserSignature, insertSignatureIntoPdf } from '../utils/signatureUtils';

// Get user's signature
const signature = getUserSignature(userId, users);

// Insert into PDF report
if (signature) {
  insertSignatureIntoPdf(signature, pdfDoc, 100, 500, 150, 75);
}
```

### Including Licences in Reports
```javascript
import { getUserLicences, formatLicences } from '../utils/signatureUtils';

// Get user's licences
const licences = getUserLicences(userId, users);

// Format for report
const formattedLicences = formatLicences(licences);
// Output: "NSW: LAA123456 (LAA), VIC: LA789012 (Lead Assessor)"
```

## Security Considerations

1. **File Validation**: All uploaded signature files are validated for type and size
2. **Image Compression**: Signatures are automatically compressed to reduce storage and improve performance
3. **Data Sanitization**: All input fields are trimmed and validated
4. **Access Control**: User management requires appropriate permissions

## Performance Considerations

1. **Image Compression**: Signatures are compressed to reduce database storage and improve load times
2. **Lazy Loading**: Signature images are only loaded when needed
3. **Validation**: Client-side validation prevents unnecessary server requests
4. **Caching**: User data is cached to reduce API calls

## Future Enhancements

1. **Signature Drawing**: Add ability to draw signatures directly in the browser
2. **Licence Verification**: Integrate with state licensing databases for automatic verification
3. **Bulk Import**: Add ability to import licences from CSV files
4. **Advanced Validation**: Add more sophisticated licence number validation patterns
5. **Signature Templates**: Pre-defined signature placement templates for different report types
6. **Licence Type Dropdown**: Pre-defined licence types for consistency 