# Air Monitoring Application - Database Schema Documentation

## Overview
This document provides a comprehensive breakdown of all database schemas used in the Air Monitoring Application, including how different collections are linked and the relationships between them.

## Database Technology
- **Database**: MongoDB
- **ODM**: Mongoose
- **Connection**: Single MongoDB instance with multiple collections

---

## Core Entity Relationships

### 1. Project-Centric Architecture
The application follows a **Project-Centric** architecture where most entities are linked through the `Project` model.

```
Client → Project → [Assessment, Clearance, Sample, Invoice, Timesheet, Equipment]
```

---

## Core Models

### 1. Project Model (`projects` collection)
**File**: `backend/models/Project.js`

**Purpose**: Central entity that links all other business entities together.

**Key Fields**:
- `projectID`: Unique identifier (LDJ00001, HAZ001 format)
- `name`: Project name
- `client`: Reference to Client (`ObjectId`)
- `department`: Enum ['Asbestos & HAZMAT', 'Occupational Hygiene', 'Client Supplied', 'air_quality']
- `categories`: Array of project types
- `status`: Project lifecycle status
- `users`: Array of assigned users (`ObjectId[]`)
- `isLargeProject`: Boolean flag for HAZ vs LDJ projects

**Relationships**:
- **One-to-Many**: `Client` → `Project`
- **Many-to-Many**: `Project` ↔ `User` (through `users` array)
- **One-to-Many**: `Project` → `Assessment`, `Clearance`, `Sample`, `Invoice`, `Timesheet`

**Indexes**:
- `{ status: 1, department: 1, createdAt: -1 }` - Main query pattern
- `{ client: 1, createdAt: -1 }` - Client projects
- `{ users: 1, createdAt: -1 }` - User-assigned projects

---

### 2. Client Model (`clients` collection)
**File**: `backend/models/Client.js`

**Purpose**: Stores client information and contact details.

**Key Fields**:
- `name`: Client name
- `invoiceEmail`: Primary contact email
- `address`: Client address
- `contact1Name/Number/Email`: Primary contact
- `contact2Name/Number/Email`: Secondary contact (optional)
- `written_off`: Boolean for financial status

**Relationships**:
- **One-to-Many**: `Client` → `Project`

---

### 3. User Model (`users` collection)
**File**: `backend/models/User.js`

**Purpose**: Manages user accounts, roles, and permissions.

**Key Fields**:
- `firstName`, `lastName`: User names
- `email`: Unique email address
- `role`: Enum ['admin', 'manager', 'employee']
- `permissions`: Array of permission strings
- `licences`: Array of professional licenses
- `signature`: User signature data
- `workingHours`: Weekly schedule configuration

**Relationships**:
- **Many-to-Many**: `User` ↔ `Project` (through `users` array in Project)
- **One-to-Many**: `User` → `Timesheet`
- **One-to-Many**: `User` → `Assessment` (as assessor)

---

## Assessment & Analysis Models

### 4. Asbestos Assessment (`asbestosassessments` collection)
**File**: `backend/models/assessmentTemplates/asbestos/AsbestosAssessment.js`

**Purpose**: Manages asbestos assessment jobs and their lifecycle.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `assessorId`: Reference to User (`ObjectId`)
- `assessmentDate`: Date of assessment
- `status`: Enum ['in-progress', 'samples-with-lab', 'sample-analysis-complete', 'report-ready-for-review', 'complete']
- `items`: Array of embedded assessment items

**Assessment Item Schema**:
- `itemNumber`: Sequential item number
- `sampleReference`: Lab sample reference
- `locationDescription`: Location of sample
- `materialType`: Type of material
- `asbestosContent`: Asbestos content percentage
- `asbestosType`: Type of asbestos
- `condition`: Material condition
- `risk`: Risk assessment
- `readyForAnalysis`: Boolean flag
- `analysisData`: Embedded analysis data for fibre ID analysis
  - `microscope`: Microscope used for analysis
  - `sampleDescription`: Sample description
  - `sampleType`: Type of sample measurement (mass/dimensions)
  - `sampleMass`: Sample mass in mg
  - `sampleDimensions`: X, Y, Z dimensions in mm
  - `ashing`: Whether ashing was required
  - `crucibleNo`: Crucible number if ashing was used
  - `fibres`: Array of fibre analysis results
  - `finalResult`: Final analysis conclusion
  - `analyzedBy`: User who performed the analysis
  - `analyzedAt`: When analysis was completed
  - `isAnalyzed`: Boolean flag indicating analysis completion

**Relationships**:
- **Many-to-One**: `AsbestosAssessment` → `Project`
- **Many-to-One**: `AsbestosAssessment` → `User` (assessor)
- **One-to-Many**: `AsbestosAssessment` → `AssessmentItem` (embedded)

---

### 5. Sample Item (`sampleitems` collection)
**File**: `backend/models/SampleItem.js`

**Purpose**: Stores individual samples for laboratory analysis.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `labReference`: Laboratory reference number
- `clientReference`: Client reference number
- `sampleDescription`: Sample description
- `analysisResult`: Analysis result status
- `analysisData`: Mixed data for analysis details
- `analyzedBy`: Reference to User or string name
- `analyzedAt`: Analysis completion date

**Relationships**:
- **Many-to-One**: `SampleItem` → `Project`
- **Many-to-One**: `SampleItem` → `User` (analyst, optional)

**Indexes**:
- `{ projectId: 1, labReference: 1 }` - Project samples
- `{ labReference: 1 }` - Unique lab reference

---

## Clearance & Certification Models

### 6. Asbestos Clearance (`asbestosclearances` collection)
**File**: `backend/models/clearanceTemplates/asbestos/AsbestosClearance.js`

**Purpose**: Manages asbestos clearance certificates and inspections.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `clearanceDate`: Date of clearance
- `clearanceType`: Enum ['Non-friable', 'Friable']
- `LAA`: Licensed Asbestos Assessor
- `asbestosRemovalist`: Removal company
- `airMonitoring`: Boolean flag
- `airMonitoringReport`: Report file reference
- `sitePlan`: Boolean flag
- `sitePlanFile`: Site plan file reference
- `items`: Array of clearance items

**Clearance Item Schema**:
- `locationDescription`: Location description
- `materialDescription`: Material description
- `asbestosType`: Enum ['non-friable', 'friable']
- `photograph`: Base64 image data
- `notes`: Additional notes

**Relationships**:
- **Many-to-One**: `AsbestosClearance` → `Project`
- **Many-to-One**: `AsbestosClearance` → `User` (createdBy, updatedBy)
- **One-to-Many**: `AsbestosClearance` → `ClearanceItem` (embedded)

**Indexes**:
- `{ projectId: 1, status: 1 }` - Project clearances
- `{ clearanceDate: 1 }` - Date-based queries

---

## Financial & Billing Models

### 7. Invoice (`invoices` collection)
**File**: `backend/models/Invoice.js`

**Purpose**: Manages client invoices and Xero integration.

**Key Fields**:
- `invoiceID`: Unique invoice identifier
- `projectId`: Reference to Project (`ObjectId`, optional)
- `client`: Reference to Client (`ObjectId`, optional)
- `amount`: Invoice total amount
- `status`: Enum ['draft', 'unpaid', 'paid', 'awaiting_approval']
- `lineItems`: Array of invoice line items
- `xeroInvoiceId`: Xero integration ID
- `xeroStatus`: Xero invoice status

**Line Item Schema**:
- `itemNo`: Item number
- `description`: Item description
- `quantity`: Item quantity
- `unitPrice`: Unit price
- `amount`: Line total

**Relationships**:
- **Many-to-One**: `Invoice` → `Project` (optional)
- **Many-to-One**: `Invoice` → `Client` (optional)

---

### 8. Invoice Item (`invoiceitems` collection)
**File**: `backend/models/InvoiceItem.js`

**Purpose**: Individual line items for invoices.

**Key Fields**:
- `invoiceId`: Reference to Invoice (`ObjectId`)
- `description`: Item description
- `quantity`: Item quantity
- `unitPrice`: Unit price
- `amount`: Line total

**Relationships**:
- **Many-to-One**: `InvoiceItem` → `Invoice`

---

## Time & Resource Management Models

### 9. Timesheet (`timesheets` collection)
**File**: `backend/models/Timesheet.js`

**Purpose**: Tracks user time spent on projects and activities.

**Key Fields**:
- `userId`: Reference to User (`ObjectId`)
- `projectId`: Reference to Project (`ObjectId`, conditional)
- `date`: Timesheet date
- `startTime`, `endTime`: Time tracking
- `description`: Work description
- `isAdminWork`: Boolean for administrative work
- `isBreak`: Boolean for break time
- `projectInputType`: Enum ['site_work', 'reporting', 'project_admin']
- `status`: Enum ['incomplete', 'finalised', 'absent']

**Relationships**:
- **Many-to-One**: `Timesheet` → `User`
- **Many-to-One**: `Timesheet` → `Project` (conditional)

**Indexes**:
- `{ userId: 1, date: 1 }` - User timesheets by date

---

### 10. Shift (`shifts` collection)
**File**: `backend/models/Shift.js`

**Purpose**: Manages air monitoring shifts and schedules.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `shiftDate`: Date of shift
- `startTime`, `endTime`: Shift timing
- `technician`: Reference to User (`ObjectId`)
- `equipment`: Array of equipment used
- `notes`: Shift notes

**Relationships**:
- **Many-to-One**: `Shift` → `Project`
- **Many-to-One**: `Shift` → `User` (technician)

---

## Equipment & Calibration Models

### 11. Air Pump (`airpumps` collection)
**File**: `backend/models/AirPump.js`

**Purpose**: Manages air monitoring equipment and calibration schedules.

**Key Fields**:
- `pumpReference`: Unique pump identifier
- `pumpDetails`: Pump description
- `calibrationDate`: Last calibration date
- `calibrationDue`: Next calibration due date
- `maxFlowrate`: Maximum flow rate
- `status`: Enum ['Active', 'Out of Service']
- `manufacturer`, `model`, `serialNumber`: Equipment details
- `lastCalibratedBy`: Reference to User (`ObjectId`)

**Relationships**:
- **Many-to-One**: `AirPump` → `User` (calibrator)

**Virtual Fields**:
- `isCalibrationOverdue`: Boolean for overdue status
- `daysUntilCalibration`: Days until calibration due

**Indexes**:
- `{ pumpReference: 1 }` - Pump lookup
- `{ status: 1 }` - Status queries
- `{ calibrationDue: 1 }` - Calibration scheduling

---

### 12. Air Pump Calibration (`airpumpcalibrations` collection)
**File**: `backend/models/AirPumpCalibration.js`

**Purpose**: Tracks calibration history and results for air pumps.

**Key Fields**:
- `pumpId`: Reference to AirPump (`ObjectId`)
- `calibrationDate`: Date of calibration
- `calibratedBy`: Reference to User (`ObjectId`)
- `flowRates`: Array of flow rate measurements
- `certificateNumber`: Calibration certificate
- `nextCalibrationDue`: Next due date

**Relationships**:
- **Many-to-One**: `AirPumpCalibration` → `AirPump`
- **Many-to-One**: `AirPumpCalibration` → `User` (calibrator)

---

### 13. Equipment (`equipment` collection)
**File**: `backend/models/Equipment.js`

**Purpose**: General equipment management.

**Key Fields**:
- `name`: Equipment name
- `type`: Equipment type
- `serialNumber`: Serial number
- `location`: Equipment location
- `status`: Equipment status

---

## Specialized Job Models

### 14. Asbestos Removal Job (`asbestosremovaljobs` collection)
**File**: `backend/models/AsbestosRemovalJob.js`

**Purpose**: Tracks asbestos removal work.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `removalDate`: Date of removal
- `removalType`: Type of removal
- `status`: Job status

**Relationships**:
- **Many-to-One**: `AsbestosRemovalJob` → `Project`

---

### 15. Client Supplied Job (`clientsuppliedjobs` collection)
**File**: `backend/models/ClientSuppliedJob.js`

**Purpose**: Manages client-supplied sample analysis jobs.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `jobType`: Type of analysis job
- `status`: Job status

**Relationships**:
- **Many-to-One**: `ClientSuppliedJob` → `Project`

---

### 16. Sample (`samples` collection)
**File**: `backend/models/Sample.js`

**Purpose**: Manages sample collections and tracking.

**Key Fields**:
- `projectId`: Reference to Project (`ObjectId`)
- `sampleType`: Type of sample
- `collectionDate`: Date collected
- `collectedBy`: Reference to User (`ObjectId`)
- `status`: Sample status

**Relationships**:
- **Many-to-One**: `Sample` → `Project`
- **Many-to-One**: `Sample` → `User` (collector)

---

## Calendar & Scheduling Models

### 17. Calendar Entry (`calendarentries` collection)
**File**: `backend/models/calendarEntry.js`

**Purpose**: Manages calendar events and scheduling.

**Key Fields**:
- `title`: Event title
- `startDate`, `endDate`: Event timing
- `description`: Event description
- `userId`: Reference to User (`ObjectId`)
- `projectId`: Reference to Project (`ObjectId`, optional)

**Relationships**:
- **Many-to-One**: `CalendarEntry` → `User`
- **Many-to-One**: `CalendarEntry` → `Project` (optional)

---

## Integration Models

### 18. Xero Token (`xerotokens` collection)
**File**: `backend/models/XeroToken.js`

**Purpose**: Stores Xero API authentication tokens.

**Key Fields**:
- `accessToken`: Xero access token
- `refreshToken`: Xero refresh token
- `expiresAt`: Token expiration
- `tenantId`: Xero tenant identifier
- `userId`: Reference to User (`ObjectId`)

**Relationships**:
- **Many-to-One**: `XeroToken` → `User`

---

### 19. Token Blacklist (`tokenblacklists` collection)
**File**: `backend/models/TokenBlacklist.js`

**Purpose**: Manages invalidated JWT tokens for security.

**Key Fields**:
- `token`: JWT token string
- `blacklistedAt`: Blacklist timestamp
- `expiresAt`: Token expiration

---

## Database Relationships Summary

### Primary Relationships
```
Client (1) ←→ (N) Project (1) ←→ (N) Assessment
                                    ↓
                              (1) ←→ (N) Sample
                                    ↓
                              (1) ←→ (N) Invoice
                                    ↓
                              (1) ←→ (N) Timesheet
                                    ↓
                              (1) ←→ (N) Shift
                                    ↓
                              (1) ←→ (N) Clearance
```

### User Relationships
```
User (1) ←→ (N) Project (through users array)
User (1) ←→ (N) Assessment (as assessor)
User (1) ←→ (N) Timesheet
User (1) ←→ (N) AirPumpCalibration
User (1) ←→ (N) Sample (as collector)
User (1) ←→ (N) CalendarEntry
```

### Assessment Workflow
```
Project → AsbestosAssessment → AssessmentItems (embedded)
                              ↓
                           AnalysisData (embedded in AssessmentItems)
                              ↓
                           AsbestosClearance → ClearanceItems (embedded)
```

---

## Indexing Strategy

### Performance Indexes
- **Compound indexes** on frequently queried field combinations
- **Single field indexes** on unique identifiers and foreign keys
- **Date-based indexes** for time-series queries
- **Status-based indexes** for workflow management

### Key Index Patterns
- `{ projectId: 1, status: 1, createdAt: -1 }` - Project queries
- `{ userId: 1, date: 1 }` - User timesheets
- `{ pumpReference: 1 }` - Equipment lookup
- `{ labReference: 1 }` - Sample tracking

---

## Data Flow Patterns

### 1. Project Creation Flow
```
Client → Project → Assessment/Clearance → Samples → Analysis
```

### 2. Assessment Workflow
```
Project → AsbestosAssessment (in-progress)
         ↓
         AssessmentItems (samples collected)
         ↓
         AssessmentItems.analysisData (lab analysis embedded)
         ↓
         AsbestosAssessment (samples-with-lab)
         ↓
         AsbestosAssessment (sample-analysis-complete)
         ↓
         AsbestosAssessment (report-ready-for-review)
         ↓
         AsbestosAssessment (complete)
```

**New Embedded Analysis Benefits**:
- **Simplified Data Structure**: Analysis data directly embedded in assessment items
- **No Cross-Collection References**: Eliminates need for SampleItems collection
- **Atomic Updates**: Single document update for analysis completion
- **Better Performance**: No joins required for analysis data retrieval

### 3. Clearance Workflow
```
Project → AsbestosClearance (in progress)
         ↓
         ClearanceItems (inspections)
         ↓
         AsbestosClearance (complete)
```

### 4. Financial Flow
```
Project → Invoice → InvoiceItems
         ↓
         Xero Integration
```

---

## Security & Access Control

### User Roles & Permissions
- **Admin**: Full system access
- **Manager**: Project and user management
- **Employee**: Limited to assigned projects and personal data

### Data Isolation
- Users can only access projects they're assigned to
- Role-based access control for sensitive operations
- JWT token authentication with blacklisting

---

## Integration Points

### External Systems
- **Xero**: Invoice synchronization and financial management
- **Google Maps**: Address autocomplete and geolocation
- **DocRaptor**: PDF generation for reports

### API Endpoints
- RESTful API with JWT authentication
- File upload/download for documents and images
- Real-time status updates for workflow management

---

## Database Maintenance

### Backup Strategy
- Regular MongoDB backups
- Point-in-time recovery capabilities
- Data archival for completed projects

### Performance Optimization
- Strategic indexing for common query patterns
- Connection pooling for high concurrency
- Query optimization and monitoring

---

## Future Considerations

### Scalability
- Horizontal scaling with MongoDB sharding
- Read replicas for reporting queries
- Caching layer for frequently accessed data

### Data Archival
- Automated archival of completed projects
- Long-term storage for compliance requirements
- Data retention policies implementation

---

*This documentation should be updated as the database schema evolves and new models are added to the system.*
