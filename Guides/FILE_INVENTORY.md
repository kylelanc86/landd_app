# Air Monitoring Application - Complete File Inventory

This document provides a comprehensive list of all files in the air_monitoring codebase, organized by folder structure, with a summary of what each file does.

## Table of Contents
- [Root Level Files](#root-level-files)
- [Backend Files](#backend-files)
- [Frontend Files](#frontend-files)
- [Guides](#guides)
- [Other Directories](#other-directories)

---

## Root Level Files

### Configuration & Setup

*Configuration files that define project dependencies, build scripts, deployment settings, and Git ignore patterns.*

- **`package.json`** - Root package.json with scripts to run frontend/backend concurrently and install all dependencies
- **`package-lock.json`** - NPM lock file for dependency version management
- **`README.md`** - Standard Create React App README with basic setup instructions
- **`render.yaml`** - Render.com deployment configuration for backend service
- **`.gitignore`** - Git ignore patterns for node_modules, build files, environment variables, logs, IDE files, and OS-specific files

### Testing & Utilities

*Utility scripts for testing and debugging the application.*

- **`test-projects-api.js`** - Test script to verify MongoDB connection and query projects with active statuses, used for debugging project filtering logic

### Documentation

*Documentation files providing guides and instructions.*

- **`git-guide.html`** - HTML guide for Git operations (9.4KB)

---

## Backend Files

### Root Backend Files

*Core backend files including the main server, package configuration, Docker files, and deployment scripts.*

- **`server.js`** - Main Express server entry point; sets up CORS, middleware, routes, database connection, and starts HTTP server with keep-alive configuration
- **`package.json`** - Backend dependencies including Express, Mongoose, JWT, Puppeteer, Xero integration, PDF generation libraries
- **`package-lock.json`** - NPM lock file for backend dependencies
- **`yarn.lock`** - Yarn lock file for backend dependencies
- **`nodemon.json`** - Nodemon configuration for development auto-restart
- **`Dockerfile`** - Multi-stage Docker build for production with Chromium for Puppeteer
- **`Dockerfile.prod`** - Production-specific Dockerfile
- **`deploy.sh`** - Deployment shell script

### Backend Configuration (`backend/config/`)

*Configuration files that set up database connections, define permission structures, and configure third-party integrations like Xero.*

- **`db.js`** - MongoDB connection configuration using Mongoose with connection state management
- **`permissions.js`** - Permission definitions and access control configuration
- **`xero.js`** - Xero accounting API configuration and setup

### Backend Middleware (`backend/middleware/`)

*Express middleware functions that handle authentication, authorization, and request processing before routes are executed. These run on every request to verify tokens, check permissions, and validate access.*

- **`auth.js`** - JWT authentication middleware; verifies tokens, handles token expiration and refresh, attaches user to request
- **`checkPermission.js`** - Permission checking middleware to verify user has required permissions for routes
- **`checkTokenBlacklist.js`** - Middleware to check if JWT token has been blacklisted (for logout functionality)

### Backend Models (`backend/models/`)

*Mongoose schema definitions that represent database collections and define the structure, validation, and relationships of data entities. Models are used to interact with MongoDB collections throughout the application.*

#### Core Models
- **`User.js`** - User model with authentication, permissions, and profile information
- **`Project.js`** - Project model for managing client projects
- **`Job.js`** - Job/work order model
- **`Client.js`** - Client/customer model
- **`Sample.js`** - Air monitoring sample model
- **`SampleItem.js`** - Individual sample item model
- **`Shift.js`** - Work shift model for air monitoring jobs
- **`Invoice.js`** - Invoice model for billing
- **`InvoiceItem.js`** - Invoice line item model
- **`Timesheet.js`** - Employee timesheet model
- **`TimesheetStatus.js`** - Timesheet status/approval workflow model
- **`ClientSuppliedJob.js`** - Client-supplied job model for external work
- **`AsbestosRemovalJob.js`** - Asbestos removal job tracking model
- **`ProjectAudit.js`** - Project audit trail model
- **`DashboardStats.js`** - Dashboard statistics aggregation model
- **`ReportTemplate.js`** - Report template model for PDF generation
- **`CustomDataField.js`** - Custom data field definition model
- **`CustomDataFieldGroup.js`** - Grouping model for custom data fields
- **`TokenBlacklist.js`** - Blacklisted JWT tokens model for logout
- **`XeroToken.js`** - Xero API token storage model

#### Equipment & Calibration Models
- **`Equipment.js`** - Laboratory equipment model
- **`AirPump.js`** - Air pump equipment model
- **`AirPumpCalibration.js`** - Air pump calibration records model
- **`GraticuleCalibration.js`** - Graticule calibration records model
- **`ArchivedGraticuleCalibration.js`** - Archived graticule calibration history model
- **`EFACalibration.js`** - Effective Filter Area calibration model
- **`PCMMicroscopeCalibration.js`** - PCM microscope calibration model
- **`CalibrationFrequency.js`** - Calibration frequency schedule model
- **`VariableCalibrationFrequency.js`** - Variable calibration frequency rules model

#### Assessment Templates (`backend/models/assessmentTemplates/`)

*Models for different types of assessments (asbestos, lead, mould) including their templates and default content structures.*

- **`asbestos/AsbestosAssessment.js`** - Asbestos assessment data model
- **`asbestos/AsbestosAssessmentTemplate.js`** - Asbestos assessment template model
- **`asbestos/defaultContent/AsbestosAssessmentContent.js`** - Default content for asbestos assessments
- **`lead/LeadAssessment.js`** - Lead assessment data model
- **`lead/defaultContent/LeadAssessmentContent.js`** - Default content for lead assessments
- **`mould/`** - Mould assessment models (directory exists but files not listed)

#### Clearance Templates (`backend/models/clearanceTemplates/`)

*Models for clearance certificates and validation documents for different material types (asbestos, lead, mould).*

- **`asbestos/AsbestosClearance.js`** - Asbestos clearance certificate model
- **`asbestos/AsbestosClearanceItems.js`** - Individual clearance items model
- **`lead/`** - Lead clearance models (directory exists but files not listed)
- **`mould/`** - Mould validation models (directory exists but files not listed)

#### Default Content (`backend/models/defaultcontent/`)

*Default content definitions used as templates when creating new reports or assessments.*

- Contains default content templates for various report types

### Backend Routes (`backend/routes/`)

*Express route handlers that define API endpoints. Each file typically handles CRUD operations for a specific resource (projects, clients, samples, etc.). Routes receive HTTP requests, interact with models/services, and return JSON responses to the frontend.*

- **`auth.js`** - Authentication routes (login, register, password reset)
- **`projects.js`** - Project CRUD operations
- **`clients.js`** - Client management routes
- **`jobs.js`** - Job/work order routes
- **`samples.js`** - Sample management routes
- **`sampleItems.js`** - Sample item routes
- **`invoices.js`** - Invoice management routes
- **`invoiceItems.js`** - Invoice item routes
- **`users.js`** - User management routes
- **`xero.js`** - Xero accounting integration routes
- **`shifts.js`** - Shift management routes
- **`timesheets.js`** - Timesheet routes
- **`airPumps.js`** - Air pump equipment routes
- **`airPumpCalibrations.js`** - Air pump calibration routes
- **`graticuleCalibrations.js`** - Graticule calibration routes
- **`efaCalibrations.js`** - EFA calibration routes
- **`pcmMicroscopeCalibrations.js`** - PCM microscope calibration routes
- **`calibrationFrequency.js`** - Calibration frequency management routes
- **`equipment.js`** - Equipment management routes
- **`asbestosClearances.js`** - Asbestos clearance routes
- **`asbestosClearanceReports.js`** - Asbestos clearance report generation routes
- **`asbestosRemovalJobs.js`** - Asbestos removal job routes
- **`asbestosAssessments.js`** - Asbestos assessment routes
- **`asbestosAssessmentTemplates.js`** - Asbestos assessment template routes
- **`asbestosClearanceTemplates.js`** - Asbestos clearance template routes
- **`leadAssessmentTemplates.js`** - Lead assessment template routes
- **`reports.js`** - Report management routes
- **`reportTemplates.js`** - Report template management routes
- **`uploadedReports.js`** - Uploaded report file management routes
- **`pdf-docraptor-v2.js`** - PDF generation using DocRaptor service routes
- **`customDataFields.js`** - Custom data field routes
- **`customDataFieldGroups.js`** - Custom data field group routes
- **`projectAudits.js`** - Project audit trail routes

### Backend Services (`backend/services/`)

*Business logic layer that contains reusable service functions. Services handle complex operations like PDF generation, email sending, data synchronization, and calculations. They are called by routes to perform the actual work.*

- **`dashboardStatsService.js`** - Service for calculating and caching dashboard statistics
- **`docraptorService.js`** - Service for generating PDFs using DocRaptor API
- **`templateService.js`** - Service for processing and rendering report templates
- **`xeroService.js`** - Service for Xero accounting API integration
- **`mailer.js`** - Email sending service using Nodemailer
- **`calibrationArchiveService.js`** - Service for archiving old calibration records
- **`efaArchiveService.js`** - Service for archiving EFA calibration records
- **`chainOfCustodyService.js`** - Service for managing sample chain of custody
- **`asbestosRemovalJobSyncService.js`** - Service for syncing asbestos removal job data
- **`projectAuditService.js`** - Service for creating and managing project audit trails

### Backend Scripts (`backend/scripts/`)

*One-time or periodic utility scripts for database migrations, data fixes, data validation, and maintenance tasks. These scripts are run manually or via npm scripts to update database structure, migrate data, or fix data issues.*

- **`addCompoundIndexes.js`** - Adds compound database indexes for performance
- **`addUsersIndex.js`** - Adds index on users field in projects collection
- **`checkAnalysisData.js`** - Validates analysis data integrity
- **`checkAssessmentItems.js`** - Validates assessment item data
- **`checkProjectData.js`** - Validates project data structure
- **`checkProjectStatuses.js`** - Validates project status values
- **`cleanCsvData.js`** - Cleans CSV import data
- **`cleanupOldTemplateCollections.js`** - Removes old template collections
- **`cleanupTokenBlacklist.js`** - Cleans expired tokens from blacklist
- **`createMixedClearanceTemplate.js`** - Creates mixed clearance templates
- **`debugSampleItems.js`** - Debugging script for sample items
- **`fixClientSuppliedJobNumberIndex.js`** - Fixes index on client supplied job numbers
- **`fixCustomDataFields.js`** - Fixes custom data field structure
- **`fixGraticuleIndexes.js`** - Fixes graticule calibration indexes
- **`fixProjectDataTypes.js`** - Fixes project data type issues
- **`initializeDashboardStats.js`** - Initializes dashboard statistics
- **`mapNamesToIds.js`** - Maps names to IDs in database
- **`mapUserNamesToIds.js`** - Maps user names to user IDs
- **`migrate-photo-numbers.js`** - Migrates photo number format
- **`migrateAnalysisData.js`** - Migrates analysis data structure
- **`migrateToCustomDataFieldGroups.js`** - Migrates to custom data field groups structure
- **`migrateToUnifiedReportTemplates.js`** - Migrates to unified report template system
- **`populateAnalysisData.js`** - Populates missing analysis data
- **`populateCustomDataFieldGroups.js`** - Populates custom data field groups
- **`populateProjectStatuses.js`** - Populates project status values
- **`removeAsbestosContentField.js`** - Removes deprecated asbestos content field
- **`restoreSoftDeletedInvoices.js`** - Restores soft-deleted invoices
- **`runMigration.js`** - Main migration runner script
- **`setReportsPresentFalse.js`** - Sets reportsPresent flag to false
- **`updateCustomDataFieldIndexes.js`** - Updates custom data field indexes
- **`updateProjectCategories.js`** - Updates project category values
- **`README.md`** - Documentation for database migration scripts
- **`projects_cleaned.csv`** - Cleaned project data CSV
- **`projects_final.csv`** - Final project data CSV
- **`projects_with_user_ids.csv`** - Project data with user IDs mapped
- **`user_mapping_summary.txt`** - Summary of user name to ID mappings

### Backend Templates (`backend/templates/DocRaptor/`)

*HTML templates used by the DocRaptor PDF generation service. These templates define the structure and layout of PDF reports, with placeholders that get filled with data from the database.*

#### Asbestos Assessment Templates
- **`AsbestosAssessment/AppendixACover.html`** - Appendix A cover page template
- **`AsbestosAssessment/AppendixBCover.html`** - Appendix B cover page template
- **`AsbestosAssessment/AsbestosAdditionalSections.html`** - Additional sections template
- **`AsbestosAssessment/AsbestosDiscussionConclusions.html`** - Discussion and conclusions template
- **`AsbestosAssessment/AsbestosItem1.html`** - Assessment item template
- **`AsbestosAssessment/AsbestosSampleItem.html`** - Sample item template
- **`AsbestosAssessment/CoverPage.html`** - Cover page template
- **`AsbestosAssessment/VersionControl.html`** - Version control page template

#### Asbestos Clearance Templates
- **`AsbestosClearance/AppendixACover.html`** - Appendix A cover page template
- **`AsbestosClearance/AppendixBCover.html`** - Appendix B cover page template
- **`AsbestosClearance/AppendixCCover.html`** - Appendix C cover page template
- **`AsbestosClearance/AsbestosClearancePhotographs.html`** - Photographs section template
- **`AsbestosClearance/BackgroundInformation.html`** - Background information template
- **`AsbestosClearance/CoverPage.html`** - Cover page template
- **`AsbestosClearance/InspectionDetails.html`** - Inspection details template
- **`AsbestosClearance/PhotoItem.html`** - Photo item template
- **`AsbestosClearance/PhotoPage.html`** - Photo page template
- **`AsbestosClearance/VersionControl.html`** - Version control page template

### Backend Utilities (`backend/utils/`)

*Reusable utility functions and helpers used across the backend, such as image processing, data transformation, and common operations.*

- **`imageCompressor.js`** - Image compression utility using Sharp library

### Backend Assets (`backend/assets/`)

*Static asset files including logos, images, and base64-encoded versions used in PDF generation and reports.*

- **`logo.png`** - Company logo
- **`logo_small.png`** - Small version of company logo
- **`logo_small hi-res.png`** - High-resolution small logo
- **`NATA_logo.png`** - NATA accreditation logo
- **`clearance_front - Copy.jpg`** - Clearance certificate front page image
- **`logo_base64_compressed.txt`** - Base64 encoded compressed logo
- **`logo_base64_hires_compressed.txt`** - Base64 encoded high-res compressed logo
- **`logo_base64_hires_optimized.txt`** - Base64 encoded optimized high-res logo
- **`logo_base64_optimized.txt`** - Base64 encoded optimized logo

### Backend Logs (`backend/logs/`)

*Application log files generated by various services, particularly scheduled tasks like Xero synchronization and cleanup operations.*

- **`xero-cleanup-2025-07-29T00-08-43-272Z.log`** - Xero cleanup service log
- **`xero-sync-2025-07-29T00-08-31-549Z.log`** - Xero sync service log

---

## Frontend Files

### Root Frontend Files

*Core frontend configuration files including package dependencies, production server setup, and deployment configuration.*

- **`package.json`** - Frontend dependencies including React, Material-UI, React Router, PDF generation libraries, Google Maps, FullCalendar
- **`package-lock.json`** - NPM lock file for frontend dependencies
- **`server.js`** - Express server for serving built React app in production with proper cache headers
- **`render.yaml`** - Render.com deployment configuration for frontend

### Frontend Source (`frontend/src/`)

#### Entry Points

*Files that bootstrap the React application and define the root component structure, routing, and global providers.*

- **`index.js`** - React application entry point, renders App component
- **`index.css`** - Global CSS styles
- **`App.jsx`** - Main application component with routing, theme provider, context providers, and all route definitions
- **`theme.js`** - Material-UI theme configuration with dark/light mode support

#### Components (`frontend/src/components/`)

*Reusable React components used throughout the application. These include UI components (buttons, tables, modals), route guards, layout components, and specialized components for specific features like maps and PDF generation.*

- **`AuthGuard.jsx`** - Component to guard routes requiring authentication
- **`GlobalSnackbar.jsx`** - Global snackbar notification component
- **`GoogleMapsDialog.jsx`** - Dialog component for Google Maps integration
- **`Header.jsx`** - Application header component
- **`Invoices.js`** - Invoice display component
- **`JobStatus.jsx`** - Job status display component
- **`Layout.jsx`** - Main layout wrapper component
- **`LoadingSpinner.jsx`** - Loading spinner component
- **`PDFLoadingOverlay.jsx`** - Overlay shown during PDF generation
- **`PermissionDeniedNotification.jsx`** - Notification for permission denied errors
- **`PermissionGate.jsx`** - Component to conditionally render based on permissions
- **`PermissionRoute.jsx`** - Route wrapper that checks permissions
- **`ProtectedRoute.jsx`** - Route wrapper that requires authentication
- **`SitePlanDrawing.jsx`** - Component for drawing site plans
- **`SitePlanMap.jsx`** - Component for displaying site plans on maps
- **`StatusCell.jsx`** - Table cell component for displaying status
- **`TruncatedCell.jsx`** - Table cell component with text truncation
- **`UsersCell.jsx`** - Table cell component for displaying users
- **`XeroConnection.js`** - Component for Xero integration status

#### Responsive Components (`frontend/src/components/responsive/`)

*Components specifically designed for responsive layouts and mobile/touch-friendly interfaces. These adapt the UI for different screen sizes and input methods.*

- **`ResponsiveGrid.jsx`** - Responsive grid layout component
- **`ResponsiveLayout.jsx`** - Responsive layout wrapper
- **`ResponsiveNavigation.jsx`** - Responsive navigation component
- **`TouchFriendlyButton.jsx`** - Touch-optimized button component

#### Configuration (`frontend/src/config/`)

*Configuration files that define feature flags, permissions, and other application-wide settings that control functionality and access.*

- **`featureFlags.js`** - Feature flag configuration and checking
- **`permissions.js`** - Frontend permission definitions matching backend

#### Context (`frontend/src/context/`)

*React Context providers that manage global application state. These provide authentication status, permissions, notifications, and other shared state to components throughout the application tree.*

- **`AuthContext.jsx`** - Authentication context provider
- **`PermissionDeniedContext.jsx`** - Context for permission denied state
- **`ProjectStatusesContext.jsx`** - Context for project status management
- **`SnackbarContext.jsx`** - Context for global snackbar notifications

#### Data (`frontend/src/data/`)

*Static data files containing form options, dropdown values, user data constants, and other configuration data used in forms and components.*

- **`formOptions.js`** - Form dropdown options and configurations
- **`userData.js`** - User data constants and helpers

#### Hooks (`frontend/src/hooks/`)

*Custom React hooks that encapsulate reusable logic for data fetching, state management, and side effects. These hooks can be used across multiple components to share common functionality.*

- **`useCustomDataFieldGroups.js`** - Hook for fetching and managing custom data field groups
- **`useDebounce.js`** - Debounce hook for delaying function execution
- **`useJobStatus.js`** - Hook for managing job status
- **`usePermissions.js`** - Hook for checking user permissions

#### Models (`frontend/src/models/`)

*Frontend data model definitions and type structures that mirror backend models, used for type checking and data validation in the frontend.*

- Contains data model definitions matching backend models

#### Scenes (`frontend/src/scenes/`) - Main application pages

*Page-level React components organized by feature area. Each scene represents a full page or major section of the application. These are the main user-facing components that compose the application's UI.*

##### Admin (`frontend/src/scenes/admin/`)

*Administrative pages for managing system configuration, templates, custom fields, and archived data.*
- **`AdminDashboard.jsx`** - Admin dashboard page
- **`ArchivedData.jsx`** - Archived data management page
- **`CustomDataFields.jsx`** - Custom data field management page
- **`InvoiceItems.jsx`** - Invoice item management page
- **`ReportTemplates.jsx`** - Report template management page
- **`TemplateTestPage.jsx`** - Page for testing report templates

##### Air Monitoring (`frontend/src/scenes/air-monitoring/`)

*Pages for managing air monitoring jobs, shifts, samples, and analysis. This is the core functionality for tracking air quality samples during asbestos removal work.*

- **`index.jsx`** - Air monitoring jobs list page
- **`air-monitoring-sample-list.jsx`** - Sample list for a shift
- **`analysis.jsx`** - Sample analysis page
- **`edit-sample.jsx`** - Edit sample page
- **`new-sample.jsx`** - Create new sample page

##### Asbestos Removal (`frontend/src/scenes/asbestos-removal/`)

*Pages for managing asbestos removal jobs and tracking removal work details.*

- **`index.jsx`** - Asbestos removal jobs list page
- **`AsbestosRemovalJobDetails.jsx`** - Detailed asbestos removal job page

##### Authentication (`frontend/src/scenes/auth/`)

*Authentication-related pages for password setup and reset functionality.*

- **`ResetPassword.jsx`** - Password reset page
- **`SetupPassword.jsx`** - Initial password setup page

##### Clearances (`frontend/src/scenes/clearances/`)

*Pages for managing clearance certificates and validation documents for asbestos, lead, and mould removal work.*

- **`ClearanceItems.jsx`** - Clearance items management page (large file, 3345 lines)
- **`LeadClearance.jsx`** - Lead clearance page
- **`MouldValidation.jsx`** - Mould validation page

##### Clients (`frontend/src/scenes/clients/`)

*Pages for managing client/customer information and viewing client details.*

- **`index.jsx`** - Clients list page
- **`ClientDetails.jsx`** - Client details page

##### Dashboard (`frontend/src/scenes/dashboard/`)

*Main dashboard page showing overview statistics, allocated jobs, and quick access to key features.*

- **`index.jsx`** - Main dashboard page
- **`AllocatedJobsTable.jsx`** - Table showing jobs allocated to current user

##### Fibre ID (`frontend/src/scenes/fibreID/`)

*Pages for managing fibre identification work, including client-supplied and LD-supplied jobs, samples, and analysis results.*

- **`index.jsx`** - Fibre ID dashboard
- **`ClientSuppliedJobs.jsx`** - Client-supplied jobs list
- **`ClientSuppliedSamples.jsx`** - Client-supplied samples list
- **`ClientSuppliedFibreCountAnalysis.jsx`** - Fibre count analysis page
- **`ClientSuppliedFibreIDAnalysis.jsx`** - Fibre ID analysis page
- **`LDsuppliedJobs.jsx`** - LD-supplied jobs list
- **`LDsuppliedItems.jsx`** - LD-supplied items list
- **`LDsuppliedAnalysisPage.jsx`** - LD-supplied analysis page

##### Global (`frontend/src/scenes/global/`)

*Global layout components including the sidebar navigation and top navigation bar used across all pages.*

- **`Sidebar.jsx`** - Application sidebar navigation
- **`Topbar.jsx`** - Top navigation bar

##### Invoices (`frontend/src/scenes/invoices/`)

*Pages for managing invoices, creating draft invoices, and editing invoice details.*

- **`index.jsx`** - Invoices list page
- **`DraftInvoicePage.jsx`** - Draft invoice creation/editing page
- **`EditInvoicePage.jsx`** - Invoice editing page

##### Laboratory (`frontend/src/scenes/laboratory/`)

*Laboratory dashboard providing access to laboratory-related features and equipment management.*

- **`index.jsx`** - Laboratory dashboard

##### Login (`frontend/src/scenes/login/`)

*User login and password reset pages for authentication.*

- **`index.jsx`** - Login page
- **`ResetPassword.jsx`** - Password reset page (duplicate of auth version)

##### Profile (`frontend/src/scenes/profile/`)

*User profile page where users can view and edit their own account information.*

- **`index.jsx`** - User profile page

##### Projects (`frontend/src/scenes/projects/`)

*Pages for managing projects, viewing project details, and editing project information.*

- **`index.jsx`** - Projects list page
- **`ProjectInformation.jsx`** - Project details and editing page

##### Records (`frontend/src/scenes/records/`)

*Records dashboard and equipment list pages for accessing various record types and laboratory equipment.*

- **`index.jsx`** - Records dashboard
- **`EquipmentList.jsx`** - Laboratory equipment list
- **`CalibrationsList.jsx`** - Calibrations list page

##### Records - Calibrations (`frontend/src/scenes/records/calibrations/`)

*Pages for managing laboratory equipment calibrations including air pumps, flowmeters, microscopes, graticules, and other calibration equipment.*

- **`index.jsx`** - Calibrations dashboard
- **`CalibrationFrequency.jsx`** - Calibration frequency management
- **`AirPumpPage.jsx`** - Air pump equipment page
- **`AirPumpCalibrationPage.jsx`** - Air pump calibration details
- **`FlowmeterPage.jsx`** - Flowmeter equipment page
- **`EFAPage.jsx`** - EFA calibration page
- **`PCMMicroscopePage.jsx`** - PCM microscope calibration page
- **`AcetoneVaporiserPage.jsx`** - Acetone vaporiser page
- **`GraticulePage.jsx`** - Graticule calibration page
- **`GraticuleHistoryPage.jsx`** - Graticule calibration history
- **`PrimaryFlowmeterPage.jsx`** - Primary flowmeter page

##### Records - Calibration Widgets (`frontend/src/scenes/records/calibrations/widgets/`)

*Reusable form widgets for entering calibration data for different types of equipment. These widgets are used within calibration pages to capture specific calibration measurements.*

- **`BaseCalibrationWidget.jsx`** - Base widget for calibration forms
- **`AcetoneVaporiser.jsx`** - Acetone vaporiser calibration widget
- **`AirPumpCalibration.jsx`** - Air pump calibration widget
- **`EFA.jsx`** - EFA calibration widget
- **`FlowmeterCalibration.jsx`** - Flowmeter calibration widget
- **`Furnace.jsx`** - Furnace calibration widget
- **`GraticuleCalibration.jsx`** - Graticule calibration widget
- **`PCMMicroscopeCalibration.jsx`** - PCM microscope calibration widget
- **`PrimaryFlowmeter.jsx`** - Primary flowmeter calibration widget
- **`PureAsbestos.jsx`** - Pure asbestos calibration widget
- **`RiLiquid.jsx`** - RI liquid calibration widget
- **`Sieves.jsx`** - Sieves calibration widget

##### Records - Other (`frontend/src/scenes/records/`)

*Various record-keeping pages for quality management, training, incidents, audits, and other compliance documentation.*

- **`approved-suppliers.jsx`** - Approved suppliers record page
- **`asset-register.jsx`** - Asset register page
- **`audits.jsx`** - Audit records page
- **`blanks.jsx`** - Blank sample records page
- **`document-register.jsx`** - Document register page
- **`feedback.jsx`** - Feedback records page
- **`impartiality-risks.jsx`** - Impartiality risks record page
- **`incidents.jsx`** - Incident records page
- **`indoor-air-quality.jsx`** - Indoor air quality records page
- **`ohs-environmental.jsx`** - OHS and environmental records page
- **`quality-control.jsx`** - Quality control records page
- **`staff-meetings.jsx`** - Staff meeting records page
- **`training.jsx`** - Training records page

##### Reports (`frontend/src/scenes/reports/`)

*Pages for viewing, managing, and generating reports. Includes project-specific reports, report categories, and report list views.*

- **`index.jsx`** - Reports dashboard
- **`ProjectDetailsModal.jsx`** - Modal for project details
- **`ProjectLogModal.jsx`** - Modal for project log
- **`ProjectLogModalWrapper.jsx`** - Wrapper for project log modal
- **`ProjectReports.jsx`** - Project-specific reports page
- **`ReportCategories.jsx`** - Report categories page
- **`ReportsList.jsx`** - Reports list page

##### Surveys (`frontend/src/scenes/surveys/`)

*Survey dashboard providing access to different types of assessment surveys.*

- **`index.jsx`** - Surveys dashboard

##### Surveys - Asbestos (`frontend/src/scenes/surveys/asbestos/`)

*Pages for managing asbestos assessments, viewing assessment lists, and managing assessment items.*

- **`index.jsx`** - Asbestos assessments list
- **`AssessmentItems.jsx`** - Assessment items page

##### Surveys - Other (`frontend/src/scenes/surveys/`)

*Pages for other types of surveys including lead assessments, residential asbestos, asbestos management plans, hazardous materials management plans, and mould/moisture assessments.*

- **`asbestos-management-plan/index.jsx`** - Asbestos management plan page
- **`hazardous-materials-management-plan/index.jsx`** - Hazardous materials management plan page
- **`lead/LeadAssessment.jsx`** - Lead assessment page
- **`mould-moisture/index.jsx`** - Mould and moisture assessment page
- **`residential-asbestos/index.jsx`** - Residential asbestos assessment page

##### Timesheets (`frontend/src/scenes/timesheets/`)

*Pages for managing employee timesheets including creating entries, editing, viewing monthly summaries, and reviewing/approving timesheets.*

- **`index.jsx`** - Timesheets list page
- **`edit.jsx`** - Edit timesheet page
- **`monthly.jsx`** - Monthly timesheet view
- **`new-entry.jsx`** - Create new timesheet entry
- **`review.jsx`** - Timesheet review/approval page
- **`view.jsx`** - View timesheet page

##### Users (`frontend/src/scenes/users/`)

*Pages for managing user accounts including viewing user lists, adding new users, and editing user information and permissions.*

- **`index.jsx`** - Users list page
- **`AddUserPage.jsx`** - Add new user page
- **`EditUserPage.jsx`** - Edit user page

##### User Manual (`frontend/src/scenes/userManual/`)

*User manual and documentation page accessible from within the application.*

- **`UserManual.jsx`** - User manual/documentation page

#### Services (`frontend/src/services/`)

*API service layer that handles all HTTP requests to the backend. Each service file contains functions for CRUD operations on a specific resource. Services use the configured axios instance and handle authentication, error handling, and data transformation.*

- **`api.js`** - Axios instance configuration with interceptors for authentication, error handling, and token refresh
- **`axios.js`** - Axios configuration (may be duplicate or alternative config)
- **`airPumpCalibrationService.js`** - API service for air pump calibrations
- **`airPumpService.js`** - API service for air pumps
- **`asbestosAssessmentService.js`** - API service for asbestos assessments
- **`asbestosClearanceReportService.js`** - API service for clearance reports
- **`asbestosClearanceService.js`** - API service for clearances
- **`asbestosRemovalJobService.js`** - API service for asbestos removal jobs
- **`assessmentService.js`** - Generic assessment service
- **`calibrationFrequencyService.js`** - API service for calibration frequencies
- **`clientService.js`** - API service for clients
- **`customDataFieldGroupService.js`** - API service for custom data field groups
- **`customDataFieldService.js`** - API service for custom data fields
- **`efaService.js`** - API service for EFA calibrations
- **`equipmentService.js`** - API service for equipment
- **`graticuleService.js`** - API service for graticule calibrations
- **`invoiceItemService.js`** - API service for invoice items
- **`pcmMicroscopeService.js`** - API service for PCM microscope calibrations
- **`projectAuditService.js`** - API service for project audits
- **`projectService.js`** - API service for projects
- **`projectStatusService.js`** - API service for project statuses
- **`recentProjectsService.js`** - API service for recent projects
- **`reportService.js`** - API service for reports
- **`reportTemplateService.js`** - API service for report templates
- **`userService.js`** - API service for users

#### Templates (`frontend/src/templates/`)

*HTML template files used for PDF generation in the frontend, providing alternative or additional templates to the backend DocRaptor templates.*

- Contains HTML template files for PDF generation

#### Utils (`frontend/src/utils/`)

*Utility functions and helpers used throughout the frontend application. These include date formatting, image compression, PDF generation, Google Maps integration, navigation helpers, and template processing utilities.*

- **`dateFormat.js`** - Date formatting utilities
- **`dateUtils.js`** - Date manipulation utilities
- **`formatters.js`** - Data formatting utilities
- **`generateFibreIDReport.js`** - Fibre ID report generation utility
- **`generateShiftReport.js`** - Shift report generation utility
- **`imageCompression.js`** - Image compression utilities
- **`loadGoogleMapsApi.js`** - Google Maps API loading utility
- **`montserrat-vfs-fonts.js`** - Montserrat font definitions for PDF generation
- **`navigationHelpers.js`** - Navigation helper functions
- **`signatureUtils.js`** - Signature handling utilities
- **`templateDataBinding.js`** - Template data binding utilities
- **`templateIntegrationExample.js`** - Example template integration
- **`templatePDFGenerator.js`** - PDF generation from templates
- **`testGoogleMapsApi.js`** - Google Maps API testing utility

### Frontend Public (`frontend/public/`)

*Static assets served directly by the web server. These files are copied to the build directory during the build process and include images, fonts, data files, and the main HTML template.*

- **`index.html`** - Main HTML template
- **`manifest.json`** - PWA manifest file
- **`Air_Monitoring_User_Manual.html`** - User manual HTML file
- **`logo.png`** - Company logo
- **`logo_small.png`** - Small logo
- **`logo_small hi-res.png`** - High-resolution small logo
- **`logo-compressed.jpg`** - Compressed logo
- **`NATA_logo.png`** - NATA logo
- **`clearance_front.jpg`** - Clearance certificate front image
- **`clearance_front - Copy.jpg`** - Copy of clearance front image
- **`clearance_front - Comp.jpg`** - Compressed clearance front image
- **`clearance_front.bmp`** - Bitmap version of clearance front
- **`layout-back.bmp`** - Layout background image
- **`login_back.jpg`** - Login background image

#### Public Subdirectories

*Organized subdirectories containing specific types of static assets including icons, fonts, images, signatures, and data files.*

- **`air-mon-icons/`** - Equipment icon images (airpump.png, effective filter area.png, fm.png, graticule.png, microscope.png, primary flowmeter.png, vaporiser.png)
- **`data/`** - CSV data files (tradifyClientData_120625.csv, tradifyProjectData_120625.csv)
- **`fonts/`** - Font files (Montserrat variants, Gothic variants, Roboto)
- **`images/`** - Image assets
- **`signatures/`** - Staff signature images (ewan.jpg, jordan.jpg, kelsey.jpg, Luke.jpg, ned.jpg, patrick.jpg, test_sig.jpg, zac.png)
- **`static/`** - Additional static assets including Montserrat font variants

### Frontend Build (`frontend/build/`)

*Production build output directory containing optimized, minified, and bundled JavaScript, CSS, and assets. This directory is generated by the React build process and is what gets deployed to production servers.*

- Contains production build output files (HTML, CSS, JS bundles, images, fonts)
- Similar structure to public directory but with optimized and bundled assets

---

## Guides

### Documentation (`Guides/`)

*Documentation files providing guides, analysis, and summaries for various aspects of the application including deployment, security, permissions, offline functionality, and migrations.*

- **`DEPLOYMENT_CACHE_GUIDE.md`** - Guide for managing browser cache issues during deployment
- **`OFFLINE_FUNCTIONALITY_ANALYSIS.md`** - Analysis of offline functionality capabilities
- **`PERMISSIONS_SUMMARY.md`** - Summary of permission system and access control
- **`REPORT_TEMPLATES_MIGRATION_README.md`** - Documentation for report templates migration
- **`SECURITY_REVIEW_AND_RECOMMENDATIONS.md`** - Security review and recommendations document

---

## Other Directories

### Build (`build/`)

*Root-level build directory containing production-ready frontend files. This is typically generated during the build process and contains the optimized application ready for deployment.*

- Production build output directory (contains built frontend files)

### Git Filter Repo (`git-filter-repo-2.47.0/`)

*Standalone Git utility tool for manipulating repository history. This is not part of the application codebase but is included for repository maintenance tasks.*

- Git filter-repo tool for repository history manipulation
- Contains documentation, tests, and the tool itself
- Not part of the main application codebase

### Node Modules (`node_modules/`)

*Directory containing all installed NPM package dependencies. This directory is generated when running `npm install` and is excluded from version control via .gitignore.*

- NPM dependencies (ignored in git)

---

## Summary Statistics

- **Total Backend Routes**: ~35 route files
- **Total Backend Models**: ~30+ model files
- **Total Backend Services**: 10 service files
- **Total Backend Scripts**: 30+ migration and utility scripts
- **Total Frontend Scenes/Pages**: 100+ page components
- **Total Frontend Services**: 25 API service files
- **Total Frontend Components**: 20+ reusable components
- **Template Files**: 18 HTML templates for PDF generation

---

## Notes

- The application uses a React frontend with Material-UI components
- Backend is Express.js with MongoDB (Mongoose)
- PDF generation uses DocRaptor service with HTML templates
- Authentication uses JWT tokens with blacklist support
- Permission-based access control throughout
- Feature flags control visibility of advanced features
- Xero integration for accounting
- Comprehensive calibration tracking system
- Multiple assessment and clearance types supported

---

*Last Updated: Generated from codebase analysis*
*Total Files Documented: 300+ files across all directories*

