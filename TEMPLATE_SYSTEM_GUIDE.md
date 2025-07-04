# Asbestos Clearance Template System

## Overview

This template system provides flexible content management for Non-friable Asbestos Removal Clearance reports. It allows you to:

1. **Edit template content** without touching code
2. **See live previews** of how content will look
3. **Use placeholders** for dynamic job data
4. **Integrate seamlessly** with existing PDF generation

## What We've Built

### 1. Template Editor (`/admin/asbestos-clearance-template`)
- **Organized sections** by page (Front Cover, Inspection Details, etc.)
- **Live preview** with sample data
- **Easy editing** with inline text editors
- **Placeholder support** using `{PLACEHOLDER_NAME}` format

### 2. Template Test Page (`/admin/template-test`)
- **Demonstrates** how templates work with sample data
- **Shows previews** of all report sections
- **Tests individual sections** for debugging

### 3. Data Binding System
- **Automatic population** of job data into templates
- **Placeholder replacement** with real values
- **Validation** of required data

### 4. Integration Utilities
- **Easy integration** with existing PDF generation
- **Example code** showing how to replace hardcoded text

## How to Use

### Accessing the Template Editor

1. Go to **Admin Dashboard** (`/admin`)
2. Click **"Asbestos Clearance Template"**
3. You'll see organized sections for each part of the report

### Editing Template Content

1. **Click the edit icon** next to any section
2. **Modify the text** in the popup editor
3. **Use placeholders** like `{CLIENT_NAME}` for dynamic content
4. **Click Save** to update the template
5. **Use the preview** to see how it looks

### Available Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{CLIENT_NAME}` | Client company name | "Sample Client Pty Ltd" |
| `{ASBESTOS_TYPE}` | Type of asbestos | "non-friable" |
| `{SITE_NAME}` | Site name/address | "123 Sample Street, Canberra ACT" |
| `{SITE_ADDRESS}` | Full site address | "123 Sample Street, Canberra ACT 2600" |
| `{PROJECT_ID}` | Project identifier | "PROJ-2024-001" |
| `{CLEARANCE_DATE}` | Clearance date | "25 July 2024" |
| `{ASBESTOS_REMOVALIST}` | Removal company | "Professional Asbestos Removal" |
| `{LAA_NAME}` | LAA name | "Patrick Cerone" |
| `{LAA_LICENSE}` | LAA license number | "AA00031" |
| `{INSPECTION_TIME}` | Inspection time | "09:00 AM" |
| `{INSPECTION_DATE}` | Inspection date | "25 July 2024" |
| `{REPORT_TYPE}` | Report type | "Non-friable" |

## Template Sections

### Front Cover
- `frontCoverTitle` - Main report title
- `frontCoverSubtitle` - Subtitle text

### Version Control
- `versionControlTitle` - Version control page title
- `preparedForLabel` - "PREPARED FOR:" label
- `preparedByLabel` - "PREPARED BY:" label
- `documentDetailsLabel` - "DOCUMENT DETAILS" label
- `revisionHistoryLabel` - "REVISION HISTORY" label

### Inspection Details
- `inspectionDetailsTitle` - Section title
- `inspectionIntroduction` - Introduction paragraph
- `inspectionSpecifics` - Specific inspection details
- `tableIntroduction` - Text before removal table
- `removalTableTitle` - Table title
- `inspectionExclusions` - Exclusions text

### Clearance Certification
- `clearanceCertificationTitle` - Section title
- `clearanceCertificationText` - Main certification text
- `riskAssessmentText` - Risk assessment statement
- `contactText` - Contact information
- `behalfText` - "For and on behalf of" text
- `signatureTitle` - Signature line text

### Background Information
- `backgroundTitle` - Section title
- `backgroundIntroduction` - Introduction text
- `bulletPoint1` - First bullet point
- `bulletPoint2` - Second bullet point
- `requirementsText` - Requirements introduction
- `bulletPoint3` - Third bullet point
- `bulletPoint4` - Fourth bullet point
- `bulletPoint5` - Fifth bullet point

### Legislative Requirements
- `legislativeTitle` - Section title
- `legislativeIntroduction` - Introduction text
- `legislativePoint1` - First legislative reference
- `legislativePoint2` - Second legislative reference
- `legislativePoint3` - Third legislative reference

### Limitations
- `limitationsTitle` - Section title
- `limitationsText` - Limitations text

### Footer
- `footerText` - Footer text

## Integration with PDF Generation

### Step 1: Import the utilities
```javascript
import { populateTemplateContent, getSectionContent } from '../utils/templateDataBinding';
```

### Step 2: Load template data
```javascript
const populatedTemplate = await populateTemplateContent(clearance);
```

### Step 3: Replace hardcoded text
Instead of:
```javascript
doc.text("ASBESTOS REMOVAL CLEARANCE CERTIFICATE", leftMargin, y);
```

Use:
```javascript
const reportTitle = populatedTemplate.standardSections.frontCoverTitle;
doc.text(reportTitle, leftMargin, y);
```

### Complete Integration Example

```javascript
export const generateClearanceReport = async (clearance, setError, options = {}) => {
  try {
    // Load and populate template
    const populatedTemplate = await populateTemplateContent(clearance);
    
    // Create PDF
    const doc = new jsPDF();
    
    // Use template content instead of hardcoded text
    const reportTitle = populatedTemplate.standardSections.frontCoverTitle;
    doc.text(reportTitle, leftMargin, y);
    
    const inspectionTitle = populatedTemplate.standardSections.inspectionDetailsTitle;
    doc.text(inspectionTitle, headerPadding3, y3);
    
    const inspectionIntro = populatedTemplate.standardSections.inspectionIntroduction;
    doc.text(inspectionIntro, headerPadding3, y3, { 
      maxWidth: pageWidth - headerPadding3 * 2, 
      align: "justify" 
    });
    
    // Continue with rest of PDF generation...
    
  } catch (error) {
    console.error("Error generating PDF:", error);
    if (setError) {
      setError("Failed to generate PDF");
    }
  }
};
```

## Testing the System

### 1. Template Test Page
Visit `/admin/template-test` to see:
- How templates look with sample data
- Individual section testing
- Job data mapping

### 2. Live Preview
In the template editor:
- Click "Show Preview" to see live content
- Edit any section and see immediate changes
- Test with different placeholder values

### 3. Integration Testing
Use the example utilities to test:
- Template loading
- Data population
- Section content retrieval

## Benefits

1. **No Code Changes** - Edit content without touching JavaScript
2. **Live Preview** - See changes immediately
3. **Flexible Positioning** - Content can be easily rearranged
4. **Consistent Branding** - Maintain professional appearance
5. **Easy Maintenance** - Update text without developer involvement
6. **Dynamic Content** - Automatic population of job-specific data

## Next Steps

1. **Test the template editor** at `/admin/asbestos-clearance-template`
2. **Review the test page** at `/admin/template-test`
3. **Integrate with your PDF generation** using the provided utilities
4. **Customize content** to match your exact requirements
5. **Add more placeholders** if needed for additional dynamic content

## Support

If you need help:
1. Check the console for error messages
2. Use the test page to debug template issues
3. Review the integration example for implementation guidance
4. Contact development team for technical support

The template system is designed to be user-friendly while maintaining the professional quality of your existing PDF reports. 