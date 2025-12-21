# Report Templates Migration Guide

## Overview

This migration consolidates 5 separate template collections into a single unified `reportTemplates` collection for better organization and management.

## What Was Consolidated

**Old Collections (to be removed):**
- `friableclearances` (FriableClearance model)
- `nonfriableclearances` (NonFriableClearance model) 
- `mixedclearances` (MixedClearance model)
- `leadassessments` (LeadAssessment model)
- `asbestosassessmenttemplates` (AsbestosAssessmentTemplate model)

**New Unified Collection:**
- `reportTemplates` (ReportTemplate model)

## Migration Steps

### 1. Run the Migration Script

```bash
cd backend
node scripts/migrateToUnifiedReportTemplates.js
```

This script will:
- Connect to your MongoDB database
- Clear any existing `reportTemplates` collection
- Migrate all templates from the old collections
- Preserve all data, timestamps, and relationships
- Verify the migration was successful

### 2. Verify Migration

Check that all templates were migrated successfully:
- You should see 5 templates in the new collection
- All template content should be preserved
- Check the admin interface to ensure templates load correctly

### 3. Test the New System

- Restart your backend server
- Test the ReportTemplates admin interface
- Verify that PDF generation still works
- Test template editing and saving

### 4. Clean Up Old Collections (Optional)

**⚠️ WARNING: This permanently deletes the old collections!**

Only run this after you're 100% confident the migration was successful:

```bash
cd backend
CONFIRM_CLEANUP=true node scripts/cleanupOldTemplateCollections.js
```

## New API Endpoints

**Old endpoints (deprecated):**
- `/api/asbestos-clearance-templates`
- `/api/lead-assessment-templates`
- `/api/asbestos-assessment-templates`

**New unified endpoint:**
- `/api/report-templates`

**Available operations:**
- `GET /api/report-templates` - Get all templates
- `GET /api/report-templates/:templateType` - Get specific template
- `POST /api/report-templates` - Create new template
- `PUT /api/report-templates/:templateType` - Update template
- `PATCH /api/report-templates/:templateType` - Update specific sections
- `DELETE /api/report-templates/:templateType` - Delete template

## Template Types

The unified system supports these template types:
- `asbestosClearanceFriable`
- `asbestosClearanceNonFriable`
- `asbestosClearanceMixed`
- `leadAssessment`
- `asbestosAssessment`

## Schema Structure

Each template in the unified collection contains:

```javascript
{
  templateType: String, // One of the supported types
  companyDetails: {
    name: String,
    address: String,
    email: String,
    phone: String,
    website: String,
    abn: String
  },
  reportHeaders: {
    title: String,
    subtitle: String
  },
  standardSections: {
    // All template sections in one object
    // Fields vary by template type
  },
  createdBy: ObjectId,
  updatedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

## Benefits of the New System

1. **Single Source of Truth**: All templates in one collection
2. **Easier Management**: Unified admin interface
3. **Consistent Schema**: Standardised structure across all template types
4. **Better Performance**: Single collection queries instead of multiple
5. **Simplified Maintenance**: One model to maintain instead of five
6. **Easier Scaling**: Adding new template types is straightforward

## Rollback Plan

If you need to rollback:

1. **Stop the migration**: Don't run the cleanup script
2. **Revert code changes**: Restore the old route files and models
3. **Restart server**: The old endpoints will work again
4. **Data is preserved**: Old collections remain intact

## Troubleshooting

### Migration Fails
- Check database connection
- Verify all old models exist
- Check for permission issues
- Review error logs

### Templates Don't Load
- Verify migration completed successfully
- Check new API endpoint is working
- Restart backend server
- Check browser console for errors

### PDF Generation Issues
- Verify templateService.js was updated
- Check template lookup logic
- Test with simple templates first

## Support

If you encounter issues:
1. Check the migration logs
2. Verify database connectivity
3. Test individual API endpoints
4. Review the console output for errors

## Post-Migration Checklist

- [ ] Migration script completed successfully
- [ ] All 5 templates appear in new collection
- [ ] Admin interface loads correctly
- [ ] Template editing works
- [ ] PDF generation functions properly
- [ ] Old collections cleaned up (optional)
- [ ] System tested thoroughly
- [ ] Team notified of changes
