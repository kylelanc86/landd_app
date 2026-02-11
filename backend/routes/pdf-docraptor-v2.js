const express = require('express');
const router = express.Router();
const DocRaptorService = require('../services/docraptorService');
const fs = require('fs');
const path = require('path');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');
const { PDFDocument } = require('pdf-lib');
const auth = require('../middleware/auth');
const AsbestosAssessment = require('../models/assessmentTemplates/asbestos/AsbestosAssessment');
const CustomDataFieldGroup = require('../models/CustomDataFieldGroup');

// Initialize DocRaptor service
const docRaptorService = new DocRaptorService();

// Custom date formatting function for CLEARANCE_DATE placeholder only
const formatClearanceDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  // Use non-breaking space between day and month to keep them on the same line
  return `${day}\u00A0${month} ${year}`;
};

// Format inspection time to ensure proper AM/PM display
const formatInspectionTime = (timeString) => {
  if (!timeString) return 'Unknown Time';
  
  const trimmedTime = timeString.trim();
  
  // If it already has AM/PM, return as-is (preserve the original format)
  if (trimmedTime.match(/\s*(AM|PM|am|pm)\s*$/i)) {
    return trimmedTime;
  }
  
  // If it's in 24-hour format (HH:MM), convert to 12-hour format with AM/PM
  const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    // Convert to 12-hour format
    if (hours === 0) {
      hours = 12; // Midnight
    } else if (hours > 12) {
      hours = hours - 12; // Afternoon/evening
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  }
  
  // If format doesn't match, return the original (might be invalid format)
  return trimmedTime;
};

// Performance monitoring removed

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** HTML for a half line break in PDF (used in discussion/conclusions and job exclusions). */
const halfLineBreakHtml = '<span style="display:block; height:0.5em;"></span>';

/** Converts newline-separated text to justified paragraph HTML for PDF (Prince needs proper blocks for text-align: justify). */
const toJustifiedParagraphsHtml = (text) => {
  if (!text || !String(text).trim()) return '';
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return String(text)
    .split(/\n/)
    .map((p) => p.trim())
    .filter((p) => p)
    .map((p) => `<p style="text-align: justify; margin: 0 0 0.5em 0; word-break: normal; overflow-wrap: break-word;">${esc(p)}</p>`)
    .join('');
};

/** Converts 1–99 to words (e.g. 11 -> "Eleven"); returns String(n) for 0 or 100+. */
const numberToWords = (n) => {
  const num = Number(n);
  if (num <= 0 || num >= 100) return String(n);
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num < 20) return ones[num];
  const t = Math.floor(num / 10);
  const o = num % 10;
  return tens[t] + (o ? '-' + ones[o] : '');
};

/** Format asbestos count for discussion/conclusions: "Eleven (11)" or "Analysis incomplete". */
const formatAsbestosCountForPdf = (asbestosCount, analysisComplete) => {
  if (asbestosCount > 0 && !analysisComplete) return 'Analysis incomplete';
  return numberToWords(asbestosCount) + ' (' + asbestosCount + ')';
};

const normalizeColorForDisplay = (value) => {
  const color = String(value || "").trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return color;
  }
  return "#FFFFFF";
};

/**
 * Generate complete HTML content for clearance report using DocRaptor-optimized templates
 */
// Generate conditional attachment text based on what attachments are present
const generateAttachmentText = (clearanceData) => {
  const hasPhotos = clearanceData.items && clearanceData.items.some(item => 
    item.photographs && item.photographs.some(photo => photo.includeInReport)
  );
  const hasSitePlan = clearanceData.sitePlan && clearanceData.sitePlanFile;
  const hasAirMonitoring = clearanceData.airMonitoring && clearanceData.airMonitoringReport;

  // No photos, site plan, or air monitoring report
  if (!hasPhotos && !hasSitePlan && !hasAirMonitoring) {
    return ''; // No text
  }

  // No site plan or air monitoring report (only photos)
  if (!hasSitePlan && !hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
  }

  // Site plan but no air monitoring report
  if (hasSitePlan && !hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A and a site plan is presented in Appendix B.';
  }

  // Site plan and air monitoring report attached
  if (hasSitePlan && hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A and a site plan is presented in Appendix B. The air monitoring report for these works is presented in Appendix C.';
  }

  // Only air monitoring report (no site plan)
  if (!hasSitePlan && hasAirMonitoring) {
    return 'Photographs of the Asbestos Removal Area are presented in Appendix A. The air monitoring report for these works is presented in Appendix B.';
  }

  return ''; // Fallback
};

const generateClearanceHTMLV2 = async (clearanceData, pdfId = 'unknown') => {
  try {
    console.log("=== PDF GENERATION STARTED ===");
    console.log("ClearanceData received:", clearanceData);
    console.log("ClearanceData items:", clearanceData?.items);
    
    // Load DocRaptor-optimized templates
    const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosClearance');
    const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
    const versionControlTemplateWithUrl = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');
    const inspectionDetailsTemplate = fs.readFileSync(path.join(templateDir, 'InspectionDetails.html'), 'utf8');
    const signOffPageTemplate = fs.readFileSync(path.join(templateDir, 'SignOffPage.html'), 'utf8');
    const backgroundInformationTemplate = fs.readFileSync(path.join(templateDir, 'BackgroundInformation.html'), 'utf8');
    const appendixACoverTemplateWithUrl = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    // photographsTemplate no longer used - photos generated independently
    const photoItemTemplate = fs.readFileSync(path.join(templateDir, 'PhotoItem.html'), 'utf8');
    const photoPageTemplate = fs.readFileSync(path.join(templateDir, 'PhotoPage.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    const appendixCCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixCCover.html'), 'utf8');
    
    // Get frontend URL from environment variable (fallback to localhost for development)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Replace [FRONTEND_URL] placeholder in all templates with actual frontend URL
    const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
    const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
    const versionControlTemplateWithUrlWithUrl = replaceFrontendUrl(versionControlTemplateWithUrl);
    const inspectionDetailsTemplateWithUrl = replaceFrontendUrl(inspectionDetailsTemplate);
    const signOffPageTemplateWithUrl = replaceFrontendUrl(signOffPageTemplate);
    const backgroundInformationTemplateWithUrl = replaceFrontendUrl(backgroundInformationTemplate);
    const appendixACoverTemplateWithUrlWithUrl = replaceFrontendUrl(appendixACoverTemplateWithUrl);
    const photoItemTemplateWithUrl = replaceFrontendUrl(photoItemTemplate);
    const photoPageTemplateWithUrl = replaceFrontendUrl(photoPageTemplate);
    const appendixBCoverTemplateWithUrl = replaceFrontendUrl(appendixBCoverTemplate);
    const appendixCCoverTemplateWithUrl = replaceFrontendUrl(appendixCCoverTemplate);
    
    // Load logo, background, and watermark images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    
    const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
    const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Fetch template content from database
    let templateType;
    
    // If useComplexTemplate is true, use Complex template regardless of clearance type
    if (clearanceData.useComplexTemplate) {
      templateType = 'asbestosClearanceComplex';
    } else {
      // Auto-determine clearance type based on asbestos items if not explicitly set
      let clearanceType = clearanceData.clearanceType;
      
      if (!clearanceType && clearanceData.items && clearanceData.items.length > 0) {
        const hasFriable = clearanceData.items.some(item => item.asbestosType === 'Friable');
        const hasNonFriable = clearanceData.items.some(item => item.asbestosType === 'Non-friable');
        
        if (hasFriable && hasNonFriable) {
          clearanceType = 'Friable (Non-Friable Conditions)';
        } else if (hasFriable) {
          clearanceType = 'Friable';
        } else {
          clearanceType = 'Non-friable';
        }
      }
      
      // Map clearance type to template type
      if (clearanceType === 'Friable') {
        templateType = 'asbestosClearanceFriable';
      } else if (clearanceType === 'Friable (Non-Friable Conditions)') {
        templateType = 'asbestosClearanceFriableNonFriableConditions';
      } else if (clearanceType === 'Vehicle/Equipment') {
        templateType = 'asbestosClearanceVehicle';
      } else if (clearanceType === 'Non-friable') {
        templateType = 'asbestosClearanceNonFriable';
      } else {
        templateType = 'asbestosClearanceNonFriable'; // Default fallback
      }
    }
    
    const templateContent = await getTemplateByType(templateType);
    
    // Debug logging for template content
    
    // Special handling for Complex clearance type - bypass default template content
    if (clearanceData.useComplexTemplate || clearanceData.clearanceType === 'Complex') {
      // For Complex clearance, we'll use minimal template content and generate custom content
      const complexTemplateContent = {
        standardSections: {
          note: "This is a Complex Clearance Certificate that requires custom content generation.",
          customSections: [
            "Project-specific requirements",
            "Specialist methodology", 
            "Custom assessment criteria",
            "Project-specific conclusions",
            "Specialist recommendations"
          ]
        }
      };
      
      // Use the complex template content instead of the default
      templateContent = complexTemplateContent;
    }



    // Determine the site address/name for the cover page
    let siteAddress = clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site';
    // If Vehicle/Equipment clearance, use vehicle equipment description instead
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      siteAddress = clearanceData.vehicleEquipmentDescription;
    }

    // Determine footer text based on clearance type
    let footerText;
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      footerText = `Inspection Certificate: ${clearanceData.vehicleEquipmentDescription}`;
    } else {
      footerText = `Asbestos Removal Clearance Certificate: ${siteAddress}`;
    }

    // Determine the report title based on clearance type
    let reportTitle = 'ASBESTOS REMOVAL<br />CLEARANCE<br />CERTIFICATE';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      reportTitle = 'INSPECTION CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable') {
      reportTitle = 'FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Non-friable') {
      reportTitle = 'NON-FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      reportTitle = 'FRIABLE ASBESTOS<br /> REMOVAL CLEARANCE<br /> CERTIFICATE';
    }

    // Populate cover template with data
    const populatedCover = coverTemplateWithUrl
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[REPORT_TITLE\]/g, reportTitle)
      .replace(/\[SITE_ADDRESS\]/g, siteAddress)
      .replace(/\[SECONDARY_HEADER\]/g, clearanceData.secondaryHeader || '')
      .replace(/\[JOB_REFERENCE\]/g, clearanceData.projectId?.projectID || 'Unknown')
      .replace(/\[CLEARANCE_DATE\]/g, formatClearanceDate(clearanceData.clearanceDate))
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')


    // Get PDF generation date (current date) - used for Issue Date in document details and Original Issue in revision history
    const pdfGenerationDate = new Date().toLocaleDateString('en-GB');
    
    // Generate revision history rows
    const generateRevisionHistory = (reportAuthoriserText) => {
      const revision = clearanceData.revision || 0;
      // Approved By should be the same as report authoriser
      const approvedBy = reportAuthoriserText;
      
      if (revision === 0) {
        // Original report - no revisions
        return `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
      } else {
        // Revised report - show revision history with actual reasons
        let revisionRows = `
          <tr>
            <td>Original Issue</td>
            <td>0</td>
            <td>${approvedBy}</td>
            <td>${pdfGenerationDate}</td>
          </tr>
        `;
        
        // Use actual revision reasons if available
        if (clearanceData.revisionReasons && clearanceData.revisionReasons.length > 0) {
          clearanceData.revisionReasons.forEach((revisionData) => {
            const revisionDate = revisionData.revisedAt ? new Date(revisionData.revisedAt).toLocaleDateString('en-GB') : pdfGenerationDate;
            // Approved By should be the same as report authoriser
            const revisedByApprovedBy = approvedBy;
            
            revisionRows += `
              <tr>
                <td>${revisionData.reason}</td>
                <td>${revisionData.revisionNumber}</td>
                <td>${revisedByApprovedBy}</td>
                <td>${revisionDate}</td>
              </tr>
            `;
          });
        } else {
          // Fallback to generic revision text if no reasons stored
          for (let i = 1; i <= revision; i++) {
            revisionRows += `
              <tr>
                <td>Report Revision</td>
                <td>${i}</td>
                <td>${approvedBy}</td>
                <td>${pdfGenerationDate}</td>
              </tr>
            `;
          }
        }
        
        return revisionRows;
      }
    };

    // Determine filename for version control (use vehicle description for Vehicle/Equipment)
    let filenameSiteName = clearanceData.projectId?.name || 'Unknown';
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      filenameSiteName = clearanceData.vehicleEquipmentDescription;
    }
    
    // Determine version control title (simple format without <br> tags)
    let versionControlTitle = 'ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      versionControlTitle = 'INSPECTION CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable') {
      versionControlTitle = 'FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Non-friable') {
      versionControlTitle = 'NON-FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      versionControlTitle = 'FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE';
    }
    
    // Determine filename for version control page (should match the actual filename)
    let reportTypeNameVC = 'Asbestos Clearance Report';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      reportTypeNameVC = 'Inspection Certificate';
    }
    
    // Determine clearance type prefix for filename (NF for Non-friable, F for Friable types)
    let clearanceTypePrefix = '';
    if (clearanceData.clearanceType === 'Non-friable') {
      clearanceTypePrefix = 'NF ';
    } else if (clearanceData.clearanceType === 'Friable' || clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      clearanceTypePrefix = 'F ';
    }
    // Vehicle/Equipment clearances don't get a prefix
    
    // Determine report authoriser text
    let reportAuthoriserText;
    if (clearanceData.reportApprovedBy) {
      // Report has been authorised - show the authoriser name
      reportAuthoriserText = clearanceData.reportApprovedBy;
    } else {
      // Report not yet authorised - show "Awaiting Authorisation" in red
      reportAuthoriserText = '<span style="color: red;">Awaiting Authorisation</span>';
    }
    
    // Populate version control template with data
    const populatedVersionControl = versionControlTemplateWithUrl
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[REPORT_TITLE\]/g, versionControlTitle)
      .replace(/\[SITE_ADDRESS\]/g, siteAddress)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')
      .replace(/\[CLEARANCE_DATE\]/g, pdfGenerationDate) // Use PDF generation date for Issue Date in document details
      .replace(/\[LAA_NAME\]/g, clearanceData.createdBy?.firstName && clearanceData.createdBy?.lastName ? `${clearanceData.createdBy.firstName} ${clearanceData.createdBy.lastName}` : clearanceData.LAA || 'Unknown LAA')
      .replace(/\[REPORT_AUTHORISER\]/g, reportAuthoriserText)
      .replace(/\[FILENAME\]/g, `${clearanceData.projectId?.projectID || 'Unknown'}: ${clearanceTypePrefix}${reportTypeNameVC} - ${filenameSiteName} (${formatClearanceDate(clearanceData.clearanceDate)})${clearanceData.sequenceNumber ? ` - ${clearanceData.sequenceNumber}` : ''}`)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, footerText)
      .replace(/<tr>\s*<td style="height: 32px"><\/td>\s*<td><\/td>\s*<td><\/td>\s*<td><\/td>\s*<\/tr>/g, generateRevisionHistory(reportAuthoriserText));

    // Generate clearance items table headers
    const generateClearanceItemsHeaders = () => {
      const items = clearanceData.items || [];
      
      // For Vehicle/Equipment clearances, only show 2 columns
      if (clearanceData.clearanceType === 'Vehicle/Equipment') {
        return '<th>Item Description</th><th style="width: 15%;">Photo No.</th>';
      }
      
      // If no items, show basic headers without Level/Floor
      if (items.length === 0) {
        return '<th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      }
      
      const hasLevelFloor = items.some(item => item.levelFloor && item.levelFloor.trim() !== '');
      
      if (hasLevelFloor) {
        return '<th>Level/Floor</th><th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      } else {
        return '<th>Item Description</th><th style="width: 18%;">Material Type</th><th style="width: 12%;">Asbestos Type</th><th style="width: 10%;">Photo No.</th>';
      }
    };

    // Generate clearance items table
    const generateClearanceItemsTable = () => {
      const items = clearanceData.items || [];
      
      if (items.length === 0) {
        const colspan = clearanceData.clearanceType === 'Vehicle/Equipment' ? 2 : (items.some(item => item.levelFloor && item.levelFloor.trim() !== '') ? 5 : 4);
        return `<tr><td colspan="${colspan}" style="text-align: center; font-style: italic;">No clearance items found</td></tr>`;
      }
      
      // First, collect all photos across all items to assign sequential numbers
      let globalPhotoCounter = 1;
      const itemsWithPhotoNumbers = items.map((item, index) => {
        const photos = item.photographs || [];
        const includedPhotos = photos.filter(p => p.includeInReport);
        
        const itemWithSequentialPhotos = {
          ...item,
          sequentialPhotoNumbers: []
        };
        
        if (includedPhotos.length > 0) {
          includedPhotos.forEach(() => {
            itemWithSequentialPhotos.sequentialPhotoNumbers.push(globalPhotoCounter);
            globalPhotoCounter++;
          });
        }
        
        return itemWithSequentialPhotos;
      });

      const tableRows = itemsWithPhotoNumbers.map((item, index) => {
        // For Vehicle/Equipment, show simplified table
        if (clearanceData.clearanceType === 'Vehicle/Equipment') {
          const itemDescription = item.materialDescription || 'No description';
          
          // Generate photo numbers text using sequential numbers
          let photoNumbersText = '-';
          if (item.sequentialPhotoNumbers.length > 0) {
            if (item.sequentialPhotoNumbers.length === 1) {
              photoNumbersText = item.sequentialPhotoNumbers[0].toString();
            } else {
              const firstNumber = item.sequentialPhotoNumbers[0];
              const lastNumber = item.sequentialPhotoNumbers[item.sequentialPhotoNumbers.length - 1];
              photoNumbersText = firstNumber === lastNumber ? firstNumber.toString() : `${firstNumber}-${lastNumber}`;
            }
          }
          
          return `<tr>
            <td>${itemDescription}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        }
        
        // Format asbestos type properly
        const formattedAsbestosType = item.asbestosType 
          ? item.asbestosType.charAt(0).toUpperCase() + item.asbestosType.slice(1).replace('-', '-')
          : 'Non-friable';
        
        // Get material type from the materialDescription field (e.g., fibre cement, vinyl tiles)
        const materialType = item.materialDescription || 'Unknown Material';
        
        // Combine room/area and location description into item description
        // roomArea: Kitchen, Bedroom, etc.
        // locationDescription: wall sheet, ceiling sheet, pipe insulation, etc.
        const roomArea = item.roomArea || 'Unknown Room/Area';
        const locationDescription = item.locationDescription || 'Unknown Location';
        const itemDescription = `${roomArea} - ${locationDescription}`;
        
        // Generate photo numbers text using sequential numbers
        let photoNumbersText = '-';
        if (item.sequentialPhotoNumbers.length > 0) {
          if (item.sequentialPhotoNumbers.length === 1) {
            photoNumbersText = item.sequentialPhotoNumbers[0].toString();
          } else {
            const firstNumber = item.sequentialPhotoNumbers[0];
            const lastNumber = item.sequentialPhotoNumbers[item.sequentialPhotoNumbers.length - 1];
            photoNumbersText = firstNumber === lastNumber ? firstNumber.toString() : `${firstNumber}-${lastNumber}`;
          }
        }
        
        // Only show Level/Floor column if at least one item has it
        const hasLevelFloor = items.some(item => item.levelFloor && item.levelFloor.trim() !== '');
        
        if (hasLevelFloor) {
          return `<tr>
            <td>${item.levelFloor || 'Not specified'}</td>
            <td>${itemDescription}</td>
            <td>${materialType}</td>
            <td>${formattedAsbestosType}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        } else {
          return `<tr>
            <td>${itemDescription}</td>
            <td>${materialType}</td>
            <td>${formattedAsbestosType}</td>
            <td>${photoNumbersText}</td>
          </tr>`;
        }
      }).join('');
      
      return tableRows;
    };

    // Generate photographs content for clearance reports using template approach
    const generateClearancePhotographsContent = () => {
      // Use actual clearance items if provided, otherwise use sample data
      const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
      
      console.log("=== PDF GENERATION DEBUG ===");
      console.log("ClearanceData items:", clearanceData.items);
      console.log("ClearanceItems found:", clearanceItems);
      console.log("ClearanceItems length:", clearanceItems.length);
      
      // Collect all photos that should be included in the report
      const photosForReport = [];
      
      clearanceItems.forEach((item, index) => {
        // console.log(`Item ${index}:`, item);
        // console.log(`Item ${index} photographs array:`, item.photographs);
        
        // Add photographs that are marked for inclusion in report
        if (item.photographs && Array.isArray(item.photographs)) {
          console.log(`Item ${index} has ${item.photographs.length} photos in array`);
          item.photographs.forEach((photo, photoIndex) => {
            console.log(`Photo ${photoIndex} in item ${index}:`, photo);
            console.log(`Photo ${photoIndex} includeInReport:`, photo.includeInReport);
            if (photo.includeInReport) {
              console.log(`Adding photo ${photoIndex} from item ${index} to report`);
              
              // For Vehicle/Equipment, use materialDescription as the item description
              // For others, store both locationDescription and materialDescription for photo description formatting
              const itemDescription = clearanceData.clearanceType === 'Vehicle/Equipment' 
                ? item.materialDescription 
                : item.locationDescription;
              
              photosForReport.push({
                photoUrl: photo.data,
                levelFloor: item.levelFloor,
                roomArea: item.roomArea,
                materialDescription: itemDescription,
                locationDescription: item.locationDescription || item.materialDescription || 'Unknown Location',
                description: photo.description // Include stored description if available
              });
            }
          });
        }
      });
      
      console.log("Total photos for report:", photosForReport.length);
      console.log("Photos for report:", photosForReport);
      
      if (photosForReport.length === 0) {
        console.log("No photos found - returning placeholder");
        return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
      }
      
      // Generate pages with 2 photos each using template
      const pages = [];
      
      for (let i = 0; i < photosForReport.length; i += 2) {
        const pagePhotos = photosForReport.slice(i, i + 2);
        const photoItems = pagePhotos.map((photo, pageIndex) => {
          const photoNumber = i + pageIndex + 1;
          
          // Use stored description if available, otherwise generate default
          let photoLocation;
          if (photo.description) {
            // Use the stored custom description
            photoLocation = photo.description;
          } else {
            // Generate default description based on clearance type
            if (clearanceData.clearanceType === 'Vehicle/Equipment') {
              photoLocation = photo.materialDescription || 'Unknown Item';
            } else {
              const roomArea = (photo.roomArea || 'unknown room/area').toLowerCase();
              const materialDesc = (photo.locationDescription || photo.materialDescription || 'unknown material').toLowerCase();
              photoLocation = `Photograph after removal of ${materialDesc} to ${roomArea}`;
            }
          }
          
          // IMPORTANT: Replace the combined placeholder FIRST before individual placeholders
          // Otherwise the individual replacements happen first and the combined won't match
          let photoItem = photoItemTemplateWithUrl
            .replace(/\[PHOTO_URL\]/g, photo.photoUrl)
            .replace(/\[PHOTO_NUMBER\]/g, photoNumber.toString())
            .replace(/\[LEVEL_FLOOR\]/g, photo.levelFloor || 'Not specified')
            .replace(/\[LEVEL_FLOOR_DISPLAY\]/g, photo.levelFloor ? 'block' : 'none');
          
          // Replace the combined location placeholder
          photoItem = photoItem.replace(/\[ROOM_AREA\] - \[MATERIAL_DESCRIPTION\]/g, photoLocation);
          
          // Then replace individual placeholders (for backwards compatibility)
          photoItem = photoItem
            .replace(/\[ROOM_AREA\]/g, photo.roomArea || 'Unknown Room/Area')
            .replace(/\[MATERIAL_DESCRIPTION\]/g, photo.materialDescription || 'Unknown Location');
          
          return photoItem;
        }).join('');
        
        // Use the photo page template and replace all placeholders
        const page = photoPageTemplateWithUrl
          .replace(/\[PHOTO_ITEMS\]/g, photoItems)
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
          .replace(/\[FOOTER_TEXT\]/g, footerText);
        
        pages.push(page);
        
        // Add page break between pages (but not after the last page)
        if (i + 2 < photosForReport.length) {
          pages.push('<div class="page-break"></div>');
        }
      }
      
      return pages.join('');
    };

    // Prepare template content placeholders first (async operations)
    // Merge clearance data with template's selectedLegislation for placeholder replacement
    const templateData = {
      ...clearanceData,
      selectedLegislation: templateContent?.selectedLegislation || []
    };
    
    const inspectionDetailsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionDetailsContent, templateData) : 'Inspection details content not found';
    const inspectionExclusionsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionExclusionsContent, templateData) : 'Inspection exclusions content not found';
    const clearanceCertificationContent = templateContent ? await replacePlaceholders(templateContent.standardSections.clearanceCertificationContent, templateData) : 'Clearance certification content not found';
    const signOffContent = templateContent ? await replacePlaceholders(templateContent.standardSections.signOffContent, templateData) : 'Sign-off content not found';

    // When 5+ items: sign-off moves to a dedicated page (page 2); Inspection Details keeps only certification. Background becomes page 3.
    const itemCount = (clearanceData.items || []).length;
    const hasSignOffPage = itemCount >= 5;
    const inspectionDetailsSignOff = hasSignOffPage ? '' : signOffContent;

    // Populate inspection details template with data
    const populatedInspectionDetails = inspectionDetailsTemplateWithUrl
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
      .replace(/\[CLEARANCE_DATE\]/g, formatClearanceDate(clearanceData.clearanceDate))
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')
      .replace(/\[ASBESTOS_TYPE\]/g, clearanceData.clearanceType || 'Non-friable')
      .replace(/\[ASBESTOS_REMOVALIST\]/g, clearanceData.asbestosRemovalist || 'Unknown Removalist')
      .replace(/\[LAA_NAME\]/g, clearanceData.LAA || 'Unknown LAA')
      .replace(/\[LAA_LICENSE\]/g, 'AA00031')
      .replace(/\[INSPECTION_TIME\]/g, formatInspectionTime(clearanceData.inspectionTime))
      .replace(/\[INSPECTION_DATE\]/g, clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[SIGNATURE_IMAGE\]/g, '') // Will be handled by replacePlaceholders in template content
      .replace(/\[CLEARANCE_ITEMS_HEADERS\]/g, generateClearanceItemsHeaders())
      .replace(/\[CLEARANCE_ITEMS_TABLE\]/g, generateClearanceItemsTable())
      // Template content placeholders
      .replace(/\[INSPECTION_DETAILS_TITLE\]/g, templateContent?.standardSections?.inspectionDetailsTitle || 'INSPECTION DETAILS')
      .replace(/\[INSPECTION_DETAILS_CONTENT\]/g, inspectionDetailsContent)
      .replace(/\[INSPECTION_EXCLUSIONS_TITLE\]/g, templateContent?.standardSections?.inspectionExclusionsTitle || 'INSPECTION EXCLUSIONS')
      .replace(/\[INSPECTION_EXCLUSIONS_CONTENT\]/g, inspectionExclusionsContent)
      .replace(/\[CLEARANCE_CERTIFICATION_TITLE\]/g, templateContent?.standardSections?.clearanceCertificationTitle || 'CLEARANCE CERTIFICATION')
      .replace(/\[CLEARANCE_CERTIFICATION_CONTENT\]/g, clearanceCertificationContent)
      .replace(/\[SIGN_OFF_CONTENT\]/g, inspectionDetailsSignOff)
      .replace(/\[ATTACHMENTS\]/g, generateAttachmentText(clearanceData))
      .replace(/\[FOOTER_TEXT\]/g, footerText);

    // Prepare background information template content placeholders (async operations)
    const backgroundInformationContent = templateContent ? await replacePlaceholders(templateContent.standardSections.backgroundInformationContent, templateData) : 'Background information content not found';
    const legislativeRequirementsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.legislativeRequirementsContent, templateData) : 'Legislative requirements content not found';
    
    // Handle limitations based on clearance type (like the old PDF route)
    let clearanceCertificateLimitationsContent;
    let clearanceCertificateLimitationsTitle;
    
    if (clearanceData.clearanceType === 'Friable') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.friableClearanceCertificateLimitationsContent, templateData) : 'Friable clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.friableClearanceCertificateLimitationsTitle || 'Friable Clearance Certificate Limitations';
    } else if (clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.friableNonFriableConditionsCertificateLimitationsContent, templateData) : 'Friable (Non-Friable Conditions) clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.friableNonFriableConditionsCertificateLimitationsTitle || 'CLEARANCE CERTIFICATE LIMITATIONS';
    } else if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.vehicleCertificateLimitationsContent, templateData) : 'Vehicle/Equipment clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.vehicleCertificateLimitationsTitle || 'Vehicle/Equipment Inspection Limitations';
    } else {
      clearanceCertificateLimitationsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.nonFriableClearanceCertificateLimitationsContent, templateData) : 'Non-friable clearance certificate limitations content not available';
      clearanceCertificateLimitationsTitle = templateContent?.standardSections?.nonFriableClearanceCertificateLimitationsTitle || 'Non-Friable Clearance Certificate Limitations';
    }

    // Populate background information template with data
    // Page number: 3 when sign-off has its own page (5+ items), otherwise 2
    const backgroundPageNumber = hasSignOffPage ? '3' : '2';
    const populatedBackgroundInformation = backgroundInformationTemplateWithUrl
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      // Template content placeholders
      .replace(/\[BACKGROUND_INFORMATION_TITLE\]/g, templateContent?.standardSections?.backgroundInformationTitle || 'BACKGROUND INFORMATION')
      .replace(/\[BACKGROUND_INFORMATION_CONTENT\]/g, backgroundInformationContent)
      .replace(/\[LEGISLATIVE_REQUIREMENTS_TITLE\]/g, templateContent?.standardSections?.legislativeRequirementsTitle || 'LEGISLATIVE REQUIREMENTS')
      .replace(/\[LEGISLATIVE_REQUIREMENTS_CONTENT\]/g, legislativeRequirementsContent)
      .replace(/\[CLEARANCE_CERTIFICATE_LIMITATIONS_TITLE\]/g, clearanceCertificateLimitationsTitle)
      .replace(/\[CLEARANCE_CERTIFICATE_LIMITATIONS_CONTENT\]/g, clearanceCertificateLimitationsContent)
      .replace(/\[BACKGROUND_PAGE_NUMBER\]/g, backgroundPageNumber)
      .replace(/\[FOOTER_TEXT\]/g, footerText);

    // Populate sign-off page (used only when 5+ items): header, footer, page number 2
    const populatedSignOffPage = hasSignOffPage
      ? signOffPageTemplateWithUrl
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[SIGN_OFF_CONTENT\]/g, signOffContent)
          .replace(/\[FOOTER_TEXT\]/g, footerText)
          .replace(/\[SIGN_OFF_PAGE_NUMBER\]/g, '2')
      : '';

    // Extract just the page content from each template
    const extractPageContent = (html) => {
      const pageMatch = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<\/body>/);
      return pageMatch ? `<div class="page">${pageMatch[1]}</div>` : html;
    };

    // Determine appendix structure based on site plan and air monitoring
    const hasSitePlan = clearanceData.sitePlan && clearanceData.sitePlanFile;
    const hasAirMonitoring = clearanceData.airMonitoring;
    
    
    // Generate dynamic appendix content
    let appendixContent = '';
    
    // Check if we have any photographs
    const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
    const hasPhotographs = clearanceItems.some(item => 
      item.photographs && Array.isArray(item.photographs) && item.photographs.length > 0
    );

    // Include Appendix A only if we have photographs
    if (hasPhotographs) {
      // For Appendix A cover, we need to keep the CSS
      const populatedAppendixACover = appendixACoverTemplateWithUrl
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[FOOTER_TEXT\]/g, footerText);

      // Generate photos section completely independently (no template mixing)
      console.log("=== ABOUT TO GENERATE PHOTOS SECTION ===");
      console.log("ClearanceData at photos generation:", clearanceData);
      const photosSection = generateClearancePhotographsContent();

      appendixContent += `
          <!-- Appendix A Cover Page -->
          ${populatedAppendixACover}
          
          <!-- Photographs Section -->
          ${photosSection}
      `;
    }
    
    // Handle Appendix B and C based on content
    if (hasSitePlan) {
      // Site Plan exists - add as Appendix B
        const populatedAppendixBCover = extractPageContent(
        appendixBCoverTemplateWithUrl
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[FOOTER_TEXT\]/g, footerText)
      );
      
      appendixContent += `
          <!-- Appendix B Cover Page (Site Plan) -->
          ${populatedAppendixBCover}
      `;
      
      // Add site plan content page if it's an image
      const isSitePlanImage = clearanceData.sitePlanFile && (
        clearanceData.sitePlanFile.startsWith('/9j/') || 
        clearanceData.sitePlanFile.startsWith('iVBORw0KGgo') ||
        clearanceData.sitePlanFile.startsWith('data:image/')
      );
      
      if (isSitePlanImage) {
        console.log(`[${pdfId}] Generating site plan content page for image data`);
        const trimmedSitePlan = await trimSitePlanImage(clearanceData.sitePlanFile);
        const clearanceDataTrimmed = { ...clearanceData, sitePlanFile: trimmedSitePlan };
        const figureTitle = clearanceData.sitePlanFigureTitle || 'Asbestos Removal Site Plan';
        const sitePlanContentPage = generateSitePlanContentPage(clearanceDataTrimmed, 'B', logoBase64, footerText, 'sitePlanFile', 'SITE PLAN', figureTitle);
        console.log(`[${pdfId}] Site plan content page length: ${sitePlanContentPage.length} characters`);
        console.log(`[${pdfId}] Site plan content contains page-break-after: ${sitePlanContentPage.includes('page-break-after')}`);
        appendixContent += `
            <!-- Appendix B Site Plan Content Page -->
            ${sitePlanContentPage}
        `;
      }
      
    if (hasAirMonitoring) {
        // Both Site Plan and Air Monitoring exist - add Air Monitoring as Appendix C
        const populatedAppendixCCover = extractPageContent(
          appendixCCoverTemplateWithUrl
            .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
            .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
            .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
            .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
            .replace(/\[FOOTER_TEXT\]/g, footerText)
        );
        
        appendixContent += `
            <!-- Appendix C Cover Page (Air Monitoring) -->
            ${populatedAppendixCCover}
        `;
      }
    } else if (hasAirMonitoring) {
      // No Site Plan but Air Monitoring exists - add Air Monitoring as Appendix B
      const populatedAppendixBCover = extractPageContent(
        appendixBCoverTemplateWithUrl
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[FOOTER_TEXT\]/g, footerText)
          .replace(/APPENDIX B/g, 'APPENDIX B')
          .replace(/SITE PLAN/g, 'AIR MONITORING REPORT')
      );
      
      appendixContent += `
          <!-- Appendix B Cover Page (Air Monitoring) -->
          ${populatedAppendixBCover}
      `;
    }

    // Create complete HTML document - each template manages its own CSS
    const completeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asbestos Clearance Report</title>
        <style>
          /* Force page breaks between sections */
          .page-break {
            page-break-before: always;
            height: 0;
            margin: 0;
            padding: 0;
          }

          /* Prevent word hyphenation globally */
          body, div, p, span, h1, h2, h3, h4, h5, h6, td, th, li {
            hyphens: none !important;
            -webkit-hyphens: none !important;
            -ms-hyphens: none !important;
            word-break: keep-all !important;
            overflow-wrap: normal !important;
          }

          /* Appendix cover page styles */
          .centered-text {
            font-size: 1.8rem;
            text-transform: uppercase;
            color: #222;
            text-align: center;
            letter-spacing: 0.02em;
            margin-top: 400px;
          }

          .appendix-title {
            font-weight: 700;
            color: #16b12b;
            display: block;
          }

          .photographs-text {
            font-weight: 400;
            display: block;
          }

          .green-line {
            width: calc(100% - 96px);
            height: 1.5px;
            background: #16b12b;
            margin: 8px auto 0 auto;
            border-radius: 0;
          }

          .content {
            padding: 10px 48px 24px 48px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            margin: 0;
          }

          /* Photographs page styles */
          .photo-container {
            display: flex;
            flex-direction: column;
            margin-bottom: 18px;
            margin-top: 18px;
          }

          .photo-container:last-child {
            margin-bottom: 0;
          }

          .photo {
            height: 400px;
            background: #f5f5f5;
            border: 2px solid #ddd;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 8px;
            position: relative;
          }

          .photo-placeholder {
            color: #999;
            font-size: 0.9rem;
            text-align: center;
          }

          .photo img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }

          .photo-details {
            font-size: 0.8rem;
            color: #222;
            line-height: 1.4;
            text-align: justify;
          }

          .photo-number {
            font-weight: 700;
            color: #16b12b;
            margin-bottom: 4px;
          }

          .photo-location {
            font-weight: 600;
            margin-bottom: 2px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 16px 48px 0 48px;
            margin: 0;
          }

          /* Site plan page header and footer styling */
          .site-plan-page .header {
            width: 100vh !important;
            box-sizing: border-box !important;
            padding: 16px 48px 0 48px !important;
          }

          .site-plan-page .footer {
            width: calc(100vh - 96px) !important;
            box-sizing: border-box !important;
            position: absolute !important;
            left: 48px !important;
            right: auto !important;
            bottom: 16px !important;
            margin: 0 !important;
          }

          .logo {
            width: 243px;
            height: auto;
            display: block;
            background: #fff;
            margin: 0;
          }

          .company-details {
            text-align: right;
            font-size: 0.75rem;
            color: #222;
            line-height: 1.5;
            margin-top: 8px;
            margin: 0;
          }

          .company-details .website {
            color: #16b12b;
            font-weight: 500;
          }

          .footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 16px;
            width: calc(100% - 96px);
            margin: 0 auto;
            text-align: justify;
            font-size: 0.75rem;
            color: #222;
          }

          .footer-line {
            width: 100%;
            height: 1.5px;
            background: #16b12b;
            margin-bottom: 6px;
            border-radius: 0;
          }

          .footer-border-line {
            width: 100%;
            height: 1.5px;
            background: #16b12b;
            margin-bottom: 6px;
            border-radius: 0;
          }

          .footer-content {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }

          .footer-text {
            flex: 1;
          }

          /* Site Plan specific styles to prevent CSS conflicts */
          .file-container {
            width: calc(100% - 96px) !important;
            max-width: calc(100% - 96px) !important;
            margin: 0 auto !important;
            padding: 0 !important;
            overflow: hidden !important;
          }

          .file-container img {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            object-fit: contain !important;
            display: block !important;
          }

          /* Landscape orientation for site plan pages */
          .site-plan-page {
            page-break-before: always;
            page-break-after: avoid !important;
            page-break-inside: avoid;
            transform: rotate(0deg);
            width: 100vh !important;
            height: 100vw !important;
            box-sizing: border-box !important;
          }

          /* Force no page break after site plan pages */
          .site-plan-page + * {
            page-break-before: avoid !important;
          }

          /* Prevent any automatic page breaks after landscape pages */
          .site-plan-page:last-child {
            page-break-after: avoid !important;
          }

          /* Use named page for landscape site plan pages */
          @page site-plan-landscape {
            size: A4 landscape;
          }

          .site-plan-page {
            page: site-plan-landscape;
          }

          /* Reduce content padding for site plan pages */
          .site-plan-page .content {
            padding: 5px 0 10px 0 !important;
            min-height: auto !important;
            height: auto !important;
            max-height: calc(100vh - 150px) !important;
            overflow: hidden !important;
          }

          /* Site plan container styling - sizes to fit image */
          .site-plan-container {
            box-shadow: none !important;
            padding: 0 !important;
            width: fit-content !important;
            max-width: 85% !important;
            box-sizing: border-box !important;
            margin: 12px 0 0 0 !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .site-plan-container img {
            border-radius: 0 !important;
            max-height: calc((100vw - 200px) * 0.99) !important;
            object-fit: contain !important;
            width: auto !important;
            height: auto !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 1px solid #999 !important;
            box-sizing: border-box !important;
            background: transparent !important;
          }

          .site-plan-legend-container {
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

        </style>
      </head>
      <body>
        <!-- Cover Page -->
          ${populatedCover}
        <div class="page-break"></div>
        
        <!-- Version Control Page -->
          ${populatedVersionControl}
        <div class="page-break"></div>
        
        <!-- Inspection Details Page -->
          ${populatedInspectionDetails}
        <div class="page-break"></div>
        ${hasSignOffPage ? `
        <!-- Sign-off Page (5+ items: dedicated page with header, footer, page 2) -->
          ${populatedSignOffPage}
        <div class="page-break"></div>
        ` : ''}
        <!-- Background Information Page -->
          ${populatedBackgroundInformation}
        
        <!-- Appendix Content -->
        ${appendixContent}
      </body>
      </html>
    `;

    return completeHTML;
  } catch (error) {
    console.error('Error generating clearance HTML V2:', error);
    throw new Error(`Failed to generate clearance HTML V2: ${error.message}`);
  }
};

/**
 * Trim whitespace from site plan image so only the drawn content is shown
 * @param {string} base64OrDataUrl - Base64 image data or data URL
 * @returns {Promise<string>} - Trimmed base64 (no data URL prefix)
 */
const trimSitePlanImage = async (base64OrDataUrl) => {
  if (!base64OrDataUrl || typeof base64OrDataUrl !== 'string') return base64OrDataUrl;
  let base64 = base64OrDataUrl;
  if (base64.startsWith('data:')) {
    const i = base64.indexOf(',');
    base64 = i >= 0 ? base64.slice(i + 1) : base64;
  }
  try {
    const sharp = require('sharp');
    const buf = Buffer.from(base64, 'base64');
    const trimmed = await sharp(buf).trim({ threshold: 10 }).toBuffer();
    return trimmed.toString('base64');
  } catch (err) {
    console.warn('Site plan image trim failed, using original:', err.message);
    return base64;
  }
};

/**
 * Generate site plan content page HTML
 * @param {Object} data - Clearance data
 * @param {string} appendixLetter - Appendix letter (B, C, etc.)
 * @param {string} logoBase64 - Base64 encoded logo
 * @param {string} footerText - Footer text to display
 * @returns {string} - HTML for site plan content page
 */
const generateSitePlanContentPage = (
  data,
  appendixLetter = 'B',
  logoBase64,
  footerText = '',
  fileField = 'sitePlanFile',
  title = 'SITE PLAN',
  figureTitle = 'Asbestos Removal Site Plan',
  legendField = 'sitePlanLegend',
  legendTitleField = 'sitePlanLegendTitle',
  cropTopBottomPx = 0
) => {
  const fileData = data[fileField];
  const legendEntries = Array.isArray(data[legendField])
    ? data[legendField]
        .filter((entry) => entry && entry.color)
        .map((entry) => ({
          color: entry.color,
          description: entry.description,
        }))
    : [];

  const legendHeading =
    (data[legendTitleField] && data[legendTitleField].trim()) || 'Key';

  if (!fileData) {
    const legendColumn =
      legendEntries.length > 0
        ? `
          <div class="site-plan-legend-container" style="flex: 0 0 15%; max-width: 180px; border: none; border-radius: 0; background-color: #ffffff; padding: 16px 20px; box-shadow: none;">
            <div style="font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; color: #1f2937;">
              ${escapeHtml(legendHeading)}
            </div>
            ${legendEntries
              .map((entry) => {
                const description =
                  entry.description && entry.description.trim()
                    ? escapeHtml(entry.description.trim())
                    : '<span style="color:#9ca3af;">(-)</span>';
              return `
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                  <span style="display:inline-block; width:18px; height:18px; min-width:18px; max-width:18px; min-height:18px; max-height:18px; border-radius:4px; border:1px solid rgba(55,65,81,0.45); background:${normalizeColorForDisplay(entry.color)}; flex-shrink:0; box-sizing:border-box;"></span>
                  <span style="font-size:8.4px; color:#334155; line-height:1.4; flex:1; margin-left:16px;">${description}</span>
                </div>
              `;
              })
              .join('')}
          </div>`
        : '';

    return `
      <div class="page site-plan-page">
        <div class="header">
          <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="green-line"></div>
        <div class="content">
          <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: center; gap: 8px; align-items: flex-start; margin: 0; padding: 0; width: 100%;">
            <div class="site-plan-container" style="flex: 0 0 60%; max-width: 600px; padding: 32px; border: none; background-color: #f9fafb; border-radius: 0; box-sizing: border-box; color: #4b5563; text-align:center; box-shadow: none;">
              <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">No Site Plan Provided</div>
              <div style="font-size: 12px;">A site plan has not been uploaded or drawn for this clearance.</div>
            </div>
            ${legendColumn}
          </div>
        </div>
        <div class="footer">
          <div class="footer-border-line"></div>
          <div class="footer-content">
            <div class="footer-text">${escapeHtml(footerText || `Asbestos Assessment Report: ${data.projectId?.name || data.siteName || 'Unknown Site'}`)}</div>
          </div>
        </div>
      </div>
    `;
  }

  const isDataUrl = fileData.startsWith('data:');
  
  let fileType, imageSrc;
  
  if (isDataUrl) {
    // It's already a complete data URL
    imageSrc = fileData;
    fileType = 'image';
  } else {
    // It's base64 data without the data URL prefix
    fileType = fileData.startsWith('/9j/') ? 'image/jpeg' : 
               fileData.startsWith('iVBORw0KGgo') ? 'image/png' : 
               'application/pdf';
    imageSrc = `data:${fileType};base64,${fileData}`;
  }
  
  let content = '';
  
  const legendColumn =
    legendEntries.length > 0
        ? `
          <div class="site-plan-legend-container" style="flex: 0 0 12%; max-width: 140px; border: 3px; border-radius: 0; background-color: #ffffff; padding: 12px 16px; align-self: stretch; box-shadow: none;">
            <div style="font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; color: #1f2937;">
              ${escapeHtml(
                (data[legendTitleField] && data[legendTitleField].trim()) ||
                  "Key"
              )}
            </div>
            ${legendEntries
              .map((entry) => {
                const description =
                  entry.description && entry.description.trim()
                    ? escapeHtml(entry.description.trim())
                    : '<span style="color:#9ca3af;">(-)</span>';
                return `
                  <div style="display:flex; align-items:center; margin-bottom:8px;">
                    <span style="display:inline-block; width:18px; height:18px; min-width:18px; max-width:18px; min-height:18px; max-height:18px; border-radius:4px; border:1px solid rgba(55,65,81,0.45); background:${normalizeColorForDisplay(entry.color)}; flex-shrink:0; box-sizing:border-box;"></span>
                    <span style="font-size:8.4px; color:#334155; margin-left:16px;">${description}</span>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : '';

  if (fileType.startsWith('image/') || isDataUrl) {
    const safeFigureTitle = escapeHtml(figureTitle || 'Site Plan');
    const cropPx = Math.max(0, Number(cropTopBottomPx) || 0);
    const imgTag = `<img src="${imageSrc}" 
                 alt="${escapeHtml(title)}" 
                 class="site-plan-image"
                 style="width: auto; height: auto; max-width: 100%; max-height: 70vh; object-fit: contain; display: block; border: 1px solid #999; margin: 0; padding: 0; box-sizing: border-box;" />`;
    content = `
      <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: center; gap: 8px; align-items: flex-start; margin: 0; padding: 0; width: 100%;">
        <div class="site-plan-container" style="flex: 0 0 auto; width: fit-content; max-width: 85%; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-sizing: border-box; box-shadow: none;">
          <div class="site-plan-image-wrapper" style="flex: 0 0 auto; width: fit-content; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 0; margin: 0; background: transparent;">
            ${cropPx > 0 ? `<div class="site-plan-crop" style="width: 100%; height: calc(100% - ${2 * cropPx}px); overflow: hidden;"><img src="${imageSrc}" alt="${escapeHtml(title)}" class="site-plan-image site-plan-image-cropped" style="display: block; width: 100%; height: calc(100% + ${2 * cropPx}px); object-fit: contain; object-position: center; margin-top: -${cropPx}px;" /></div>` : imgTag}
          </div>
          <div class="site-plan-figure-caption" style="font-size: 14px; font-weight: 600; color: #1f2937; text-align: center; margin-top: 12px;">
            Figure 1: ${safeFigureTitle}
          </div>
        </div>
        ${legendColumn}
      </div>
    `;
  } else {
    content = `
      <div class="site-plan-layout" style="display: flex; flex-direction: row; justify-content: center; gap: 8px; align-items: flex-start; margin: 0; padding: 0; width: 100%;">
        <div class="site-plan-container" style="flex: 1; max-width: 100%; padding: 0; border: none; background-color: #ffffff; border-radius: 0; box-sizing: border-box; text-align:center; box-shadow: none;">
          <div class="appendix-title" style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text" style="font-size: 14px; text-transform: uppercase; margin-bottom: 8px;">${title}</div>
          <div class="file-note" style="font-size: 12px; color: #4b5563;">Document attached</div>
        </div>
        ${legendColumn}
      </div>
    `;
  }

  return `
        <div class="page site-plan-page">
          <div class="header">
            <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="green-line"></div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <div class="footer-border-line"></div>
            <div class="footer-content">
              <div class="footer-text">${escapeHtml(footerText || `Asbestos Assessment Report: ${data.projectId?.name || data.siteName || 'Unknown Site'}`)}</div>
            </div>
          </div>
        </div>
      `;
};

/**
 * Merge two PDFs together
 * @param {Buffer} pdf1Buffer - First PDF buffer (clearance report)
 * @param {string} pdf2Base64 - Second PDF as base64 string (air monitoring report or site plan)
 * @returns {Promise<Buffer>} - Merged PDF as buffer
 */
const mergePDFs = async (pdf1Buffer, pdf2Base64) => {
  try {
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    
    // Load the first PDF (clearance report or assessment report)
    const pdf1Doc = await PDFDocument.load(pdf1Buffer);
    const pdf1Pages = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
    pdf1Pages.forEach((page) => mergedPdf.addPage(page));
    
    // Load the second PDF (air monitoring report or site plan) from base64
    // Handle both pure base64 and data URL formats
    let cleanBase64 = pdf2Base64;
    if (pdf2Base64.startsWith('data:')) {
      cleanBase64 = pdf2Base64.split(',')[1];
    }
    const pdf2Buffer = Buffer.from(cleanBase64, 'base64');
    
    // Load the second PDF with specific options to preserve layout
    const pdf2Doc = await PDFDocument.load(pdf2Buffer, {
      ignoreEncryption: true,
      updateMetadata: false
    });
    
    
    // Try to fix the coordinate system issue by using a different approach
    // Instead of trying to normalize dimensions, let's try to preserve the original layout
    try {
      const pdf2Pages = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
      pdf2Pages.forEach((page, index) => {
        // Add the page directly without any modifications
        // This preserves the original coordinate system and layout exactly as generated
        mergedPdf.addPage(page);
      });
    } catch (copyError) {
      console.error('Error copying pages:', copyError.message);
      throw copyError;
    }
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
  } catch (error) {
    console.error('Error in mergePDFs:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

/**
 * Generate Asbestos Clearance Report using DocRaptor V2 templates
 */
router.post('/generate-asbestos-clearance-v2', async (req, res) => {
  const pdfId = `clearance-v2-${Date.now()}`;
  
  try {
    console.log("=== PDF GENERATION ENDPOINT CALLED ===");
    console.log("Request body:", req.body);
    
    const { clearanceData } = req.body;
    
    console.log("ClearanceData extracted:", clearanceData);
    console.log("ClearanceData items:", clearanceData?.items);
    
    if (!clearanceData) {
      return res.status(400).json({ error: 'Clearance data is required' });
    }


    // Validate clearance data
    if (!clearanceData._id && !clearanceData.projectId) {
      return res.status(400).json({ error: 'Invalid clearance data' });
    }

    // Generate HTML content using new templates
    const htmlContent = await generateClearanceHTMLV2(clearanceData, pdfId);

    // DIAGNOSTIC: Log HTML content length and structure
    console.log(`[${pdfId}] HTML Content Length: ${htmlContent.length} characters`);
    console.log(`[${pdfId}] HTML contains site-plan-page: ${htmlContent.includes('site-plan-page')}`);
    console.log(`[${pdfId}] HTML contains site-plan-landscape: ${htmlContent.includes('site-plan-landscape')}`);
    console.log(`[${pdfId}] HTML contains page-break-after: ${htmlContent.includes('page-break-after')}`);
    
    // DIAGNOSTIC: Count page elements
    const pageCount = (htmlContent.match(/<div class="page/g) || []).length;
    const sitePlanPageCount = (htmlContent.match(/site-plan-page/g) || []).length;
    console.log(`[${pdfId}] Total pages in HTML: ${pageCount}`);
    console.log(`[${pdfId}] Site plan pages: ${sitePlanPageCount}`);

    // Generate filename
    const projectId = clearanceData.projectId?.projectID || clearanceData.project?.projectID || clearanceData.projectId || 'Unknown';
    let siteName = clearanceData.projectId?.name || clearanceData.project?.name || clearanceData.siteName || 'Unknown';
    
    // If Vehicle/Equipment clearance, use vehicle equipment description for filename
    if (clearanceData.clearanceType === 'Vehicle/Equipment' && clearanceData.vehicleEquipmentDescription) {
      siteName = clearanceData.vehicleEquipmentDescription;
    }
    
    const clearanceDate = clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown';
    
    // Use different report type name in filename based on clearance type
    let reportTypeName = 'Asbestos Clearance Report';
    if (clearanceData.clearanceType === 'Vehicle/Equipment') {
      reportTypeName = 'Inspection Certificate';
    }
    
    // Determine clearance type prefix for filename (NF for Non-friable, F for Friable types)
    let clearanceTypePrefix = '';
    if (clearanceData.clearanceType === 'Non-friable') {
      clearanceTypePrefix = 'NF ';
    } else if (clearanceData.clearanceType === 'Friable' || clearanceData.clearanceType === 'Friable (Non-Friable Conditions)') {
      clearanceTypePrefix = 'F ';
    }
    // Vehicle/Equipment clearances don't get a prefix
    
    // Add sequence number suffix if it exists (for multiple clearances of same type/project/date)
    const sequenceSuffix = clearanceData.sequenceNumber ? ` - ${clearanceData.sequenceNumber}` : '';
    const filename = `${projectId}_${clearanceTypePrefix}${reportTypeName} - ${siteName} (${clearanceDate})${sequenceSuffix}.pdf`;

    // Generate PDF using DocRaptor with optimized settings
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent, {
      // DocRaptor-specific options for better page handling
      page_size: 'A4',
      prince_options: {
        page_margin: '0.5in',
        media: 'print',
        html_mode: 'quirks'  // Force consistent rendering
      }
    });

    // DIAGNOSTIC: Log PDF generation results
    console.log(`[${pdfId}] DocRaptor PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // DIAGNOSTIC: Save HTML to file for inspection (temporary debugging)
    if (process.env.NODE_ENV === 'development') {
      const fs = require('fs');
      const path = require('path');
      const htmlFilePath = path.join(__dirname, '..', 'debug', `clearance-${pdfId}.html`);
      fs.mkdirSync(path.dirname(htmlFilePath), { recursive: true });
      fs.writeFileSync(htmlFilePath, htmlContent);
      console.log(`[${pdfId}] HTML content saved to: ${htmlFilePath}`);
    }


    // Handle PDF merging for site plan and air monitoring reports
    let finalPdfBuffer = pdfBuffer;

    // If there's an air monitoring report, merge it with the generated PDF
    if (clearanceData.airMonitoringReport) {
      try {
        // Now that frontend generates PDFs, airMonitoringReport should always be base64 data
        const mergedPdf = await mergePDFs(finalPdfBuffer, clearanceData.airMonitoringReport);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`Error merging air monitoring PDFs:`, error);
      }
    }

    // If there's a site plan PDF (not an image), merge it with the generated PDF
    if (clearanceData.sitePlan && clearanceData.sitePlanFile && !clearanceData.sitePlanFile.startsWith('/9j/') && !clearanceData.sitePlanFile.startsWith('iVBORw0KGgo') && !clearanceData.sitePlanFile.startsWith('data:image/')) {
      try {
        const mergedPdf = await mergePDFs(finalPdfBuffer, clearanceData.sitePlanFile);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`Error merging site plan PDFs:`, error);
      }
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', finalPdfBuffer.length);

    // Send final PDF buffer
    res.send(finalPdfBuffer);

  } catch (error) {
    console.error(`[${pdfId}] Error generating clearance V2 PDF:`, error);
    res.status(500).json({ 
      error: 'Failed to generate clearance V2 PDF',
      details: error.message 
    });
  }
});

/**
 * Test DocRaptor V2 with simple HTML
 */
router.post('/test-v2', async (req, res) => {
  try {
    
    const simpleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor V2 Test</title>
        <style>
          @page {
            size: A4;
            margin: 0.25in;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 20px;
          }
          h1 { color: blue; }
          .page {
            page-break-after: always;
            margin: 0;
            padding: 0;
          }
          .page:last-child {
            page-break-after: avoid;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>DocRaptor V2 Test - Page 1</h1>
          <p>This is a test PDF generated at ${new Date().toISOString()}</p>
          <p>If you can see this, DocRaptor V2 is working!</p>
        </div>
        <div class="page">
          <h1>DocRaptor V2 Test - Page 2</h1>
          <p>This is the second page to test page breaks.</p>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(simpleHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-v2.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('V2 test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'V2 test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG scaling
 */
router.post('/test-svg-scaling', async (req, res) => {
  try {
    
    const svgTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG Scaling Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">SVG Scaling Test - Red dot should be at top-left corner</div>
          <svg class="test-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <!-- Test rectangle covering entire viewBox -->
            <rect x="0" y="0" width="595" height="842" fill="lightblue" stroke="blue" stroke-width="2"/>
            <!-- Test diagonal line from top-left to bottom-right -->
            <line x1="0" y1="0" x2="595" y2="842" stroke="red" stroke-width="5"/>
            <!-- Test horizontal line at y=200 -->
            <line x1="0" y1="200" x2="595" y2="200" stroke="green" stroke-width="3"/>
            <!-- Test vertical line at x=297.5 (center) -->
            <line x1="297.5" y1="0" x2="297.5" y2="842" stroke="purple" stroke-width="3"/>
            <!-- Test circle at center -->
            <circle cx="297.5" cy="421" r="50" fill="yellow" stroke="black" stroke-width="2"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(svgTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-scaling-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG scaling test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG scaling test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG viewBox and clipping
 */
router.post('/test-svg-viewbox', async (req, res) => {
  try {
    
    const viewBoxTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG ViewBox Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">ViewBox Test - Red line should extend to edges</div>
          <svg class="test-svg" viewBox="-50 -50 695 942" xmlns="http://www.w3.org/2000/svg">
            <!-- Background to show viewBox -->
            <rect x="-50" y="-50" width="695" height="942" fill="lightgray" stroke="blue" stroke-width="2"/>
            <!-- Test line that should extend to edges -->
            <line x1="-50" y1="-50" x2="645" y2="892" stroke="red" stroke-width="10"/>
            <!-- Test diagonal shape -->
            <polygon points="-50,-50 645,150 645,692 -50,892" fill="yellow" stroke="black" stroke-width="3"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(viewBoxTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-viewbox-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG viewBox test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG viewBox test failed',
      details: error.message
    });
  }
});

/**
 * Test DocRaptor SVG coordinate mapping
 */
router.post('/test-svg-coordinates', async (req, res) => {
  try {
    
    const coordinateTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor SVG Coordinate Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 842px;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 10px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Coordinate Test - Red dots at y=0, y=200, y=642, y=842</div>
          <svg class="test-svg" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <!-- Background rectangle -->
            <rect x="0" y="0" width="595" height="842" fill="lightgray" stroke="black" stroke-width="1"/>
            <!-- Test dots at key coordinates -->
            <circle cx="50" cy="0" r="5" fill="red"/> <!-- Top edge -->
            <circle cx="50" cy="200" r="5" fill="red"/> <!-- Middle top -->
            <circle cx="50" cy="642" r="5" fill="red"/> <!-- Middle bottom -->
            <circle cx="50" cy="842" r="5" fill="red"/> <!-- Bottom edge -->
            <!-- Test lines -->
            <line x1="0" y1="0" x2="595" y2="0" stroke="blue" stroke-width="2"/> <!-- Top edge -->
            <line x1="0" y1="200" x2="595" y2="200" stroke="green" stroke-width="2"/> <!-- Middle top -->
            <line x1="0" y1="642" x2="595" y2="642" stroke="green" stroke-width="2"/> <!-- Middle bottom -->
            <line x1="0" y1="842" x2="595" y2="842" stroke="blue" stroke-width="2"/> <!-- Bottom edge -->
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(coordinateTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-coordinate-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('SVG coordinate test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'SVG coordinate test failed',
      details: error.message
    });
  }
});

/**
 * Test minimal cover page structure
 */
router.post('/test-cover-structure', async (req, res) => {
  try {
    
    const coverTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cover Page Structure Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 842px;
            position: relative;
            background: #fff;
            margin: 0;
            padding: 0;
          }
          .cover-white-shape {
            position: absolute;
            top: 0;
            left: 0;
            width: 50%;
            height: 100%;
            z-index: 1;
            pointer-events: none;
            margin: 0;
            padding: 0;
          }
          .cover-left {
            width: 50%;
            position: relative;
            z-index: 3;
            height: 100%;
            margin: 0;
            padding: 0;
          }
          .green-bracket {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 4;
            pointer-events: none;
            margin: 0;
            padding: 0;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 10px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Cover Structure Test - White shape should fill left half</div>
          <svg class="cover-white-shape" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
            <polygon points="0,0 595,200 595,642 0,842" fill="white"/>
          </svg>
          <div class="cover-left">
            <svg class="green-bracket" viewBox="0 0 595 842" xmlns="http://www.w3.org/2000/svg">
              <polyline points="0,0 595,200" stroke="#16b12b" stroke-width="12" fill="none"/>
              <polyline points="595,196 595,646" stroke="#16b12b" stroke-width="12" fill="none"/>
              <polyline points="595,642 0,842" stroke="#16b12b" stroke-width="12" fill="none"/>
            </svg>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(coverTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="cover-structure-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Cover structure test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Cover structure test failed',
      details: error.message
    });
  }
});

/**
 * Test different A4 dimensions
 */
router.post('/test-a4-dimensions-v2', async (req, res) => {
  try {
    
    const dimensionTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>DocRaptor A4 Dimension Test V2</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100%;
            position: relative;
            background: #fff;
          }
          .test-svg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Testing different viewBox values</div>
          <svg class="test-svg" viewBox="0 0 794 1123" xmlns="http://www.w3.org/2000/svg">
            <!-- Test with 794x1123 (US Letter equivalent) -->
            <rect x="0" y="0" width="794" height="1123" fill="none" stroke="red" stroke-width="5"/>
            <circle cx="50" cy="50" r="20" fill="blue"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(dimensionTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="a4-dimension-test-v2.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('A4 dimension test V2 error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'A4 dimension test V2 failed',
      details: error.message
    });
  }
});

/**
 * Test SVG without viewBox
 */
router.post('/test-svg-simple', async (req, res) => {
  try {
    
    const simpleTestHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Simple SVG Test</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body { 
            font-family: Arial, sans-serif; 
            margin: 0;
            padding: 0;
          }
          .page {
            width: 100%;
            height: 100%;
            position: relative;
            background: #fff;
          }
          .test-text {
            position: absolute;
            top: 10px;
            left: 10px;
            font-size: 12px;
            color: red;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="test-text">Simple SVG Test - No viewBox</div>
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="red" stroke-width="5"/>
            <circle cx="50" cy="50" r="20" fill="blue"/>
          </svg>
        </div>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(simpleTestHTML, {
      page_size: 'A4',
      page_margin: '0in'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="svg-simple-test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Simple SVG test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Simple SVG test failed',
      details: error.message
    });
  }
});

router.post('/generate-asbestos-assessment', auth, async (req, res) => {
  const pdfId = `assessment-${Date.now()}`;

  try {
    const { assessmentData } = req.body;
    if (!assessmentData) {
      throw new Error('Assessment data is required');
    }

    // Generate HTML content
    const html = await generateAssessmentHTML(assessmentData);

    // Generate PDF with DocRaptor
    let pdfBuffer = await docRaptorService.generatePDF(html);

    // Check if there are analysed items and note that fibre analysis report is available
    const analysedItems = assessmentData.items?.filter(item => item.analysisData?.isAnalysed) || [];

    // Handle PDF merging for fibre analysis report (same approach as clearance reports)
    let finalPdfBuffer = pdfBuffer;

    // If there's a fibre analysis report, merge it with the generated PDF
    if (assessmentData.fibreAnalysisReport) {
      try {
        const mergedPdf = await mergePDFs(finalPdfBuffer, assessmentData.fibreAnalysisReport);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`[${pdfId}] Error merging fibre analysis PDFs:`, error);
      }
    }

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', finalPdfBuffer.length);
    res.send(finalPdfBuffer);

  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Experimental v3 asbestos assessment generator:
// - Generates cover + version control using existing templates (stable layout)
// - Generates the remainder of the report using a flow-based template with running header/footer
//   so DocRaptor can paginate automatically for large documents.
router.post('/generate-asbestos-assessment-v3', auth, async (req, res) => {
  const pdfId = `assessment-v3-${Date.now()}`;

  try {
    const { assessmentData, isResidential } = req.body;
    if (!assessmentData) {
      throw new Error('Assessment data is required');
    }

    // Load fibre analysis report and site plan from DB by assessment id (same idea as clearance: large blobs live on the document; we fetch here so they attach without frontend sending huge base64)
    const assessmentId = assessmentData._id || assessmentData.id;
    const idStr = assessmentId ? String(assessmentId) : null;
    if (idStr) {
      try {
        const doc = await AsbestosAssessment.findById(idStr)
          .select('state fibreAnalysisReport sitePlan sitePlanFile sitePlanLegend sitePlanLegendTitle sitePlanFigureTitle')
          .lean();
        if (doc) {
          // Ensure state is set from DB for placeholder replacement (e.g. {10m2_RULE}, {STATE_SPECIFIC_REMOVAL_RECS})
          if (doc.state != null) assessmentData.state = doc.state;
          if (doc.fibreAnalysisReport) {
            assessmentData.fibreAnalysisReport = doc.fibreAnalysisReport;
            console.log(`[${pdfId}] Loaded fibre analysis report from DB (length: ${doc.fibreAnalysisReport.length})`);
          } else {
            console.log(`[${pdfId}] No fibre analysis report in DB for assessment ${idStr}`);
          }
          if (doc.sitePlan != null) assessmentData.sitePlan = doc.sitePlan;
          if (doc.sitePlanFile != null) assessmentData.sitePlanFile = doc.sitePlanFile;
          if (doc.sitePlanLegend != null) assessmentData.sitePlanLegend = doc.sitePlanLegend;
          if (doc.sitePlanLegendTitle != null) assessmentData.sitePlanLegendTitle = doc.sitePlanLegendTitle;
          if (doc.sitePlanFigureTitle != null) assessmentData.sitePlanFigureTitle = doc.sitePlanFigureTitle;
        } else {
          console.warn(`[${pdfId}] Assessment not found in DB: ${idStr}`);
        }
      } catch (err) {
        console.warn(`[${pdfId}] Could not load fibre analysis report or site plan from DB:`, err.message);
      }
    } else {
      console.warn(`[${pdfId}] No assessment ID in request body - cannot load fibre analysis report from DB`);
    }

    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    // Generate cover + version control PDF (existing templates)
    const coverVersionHtml = await generateAssessmentCoverVersionHTMLV3(assessmentData, isResidential === true);
    const coverVersionPdf = await docRaptorService.generatePDF(coverVersionHtml);

    // Generate flow-based body PDF (automatic pagination; page numbers only on these pages)
    const flowHtml = await generateAssessmentFlowHTMLV3(assessmentData, isResidential === true);
    const flowPdf = await docRaptorService.generatePDF(flowHtml);

    const hasFibreIdReport = !!assessmentData.fibreAnalysisReport;
    const hasSitePlan = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);

    // Appendix A cover (no page number in footer); only when there are samples (fibre ID report attachment)
    let appendixACoverPdf = null;
    if (hasFibreIdReport) {
      const appendixAHtml = generateAppendixCoverHTMLV3('A', assessmentData);
      appendixACoverPdf = await docRaptorService.generatePDF(appendixAHtml);
    }

    // Site plan appendix cover: Appendix A when no fibre ID report, Appendix B when fibre ID report exists
    let sitePlanAppendixCoverPdf = null;
    if (hasSitePlan) {
      const sitePlanAppendixLetter = hasFibreIdReport ? 'B' : 'A';
      const sitePlanCoverHtml = generateAppendixCoverHTMLV3('B', assessmentData, sitePlanAppendixLetter);
      sitePlanAppendixCoverPdf = await docRaptorService.generatePDF(sitePlanCoverHtml);
    }

    // Merge: cover+version, flow, Appendix A cover, fibre analysis (Certificate of Analysis), Appendix B cover, then site plan content
    let merged = await mergePdfBuffers([coverVersionPdf, flowPdf]);
    if (appendixACoverPdf) {
      merged = await mergePdfBuffers([merged, appendixACoverPdf]);
    }
    if (assessmentData.fibreAnalysisReport) {
      try {
        merged = await mergePDFs(merged, assessmentData.fibreAnalysisReport);
      } catch (error) {
        console.error(`[${pdfId}] Error merging fibre analysis PDFs:`, error);
      }
    }
    if (sitePlanAppendixCoverPdf) {
      merged = await mergePdfBuffers([merged, sitePlanAppendixCoverPdf]);
    }
    if (hasSitePlan && assessmentData.sitePlanFile) {
      const isSitePlanImage = assessmentData.sitePlanFile.startsWith('/9j/') ||
        assessmentData.sitePlanFile.startsWith('iVBORw0KGgo') ||
        assessmentData.sitePlanFile.startsWith('data:image/');
      if (isSitePlanImage) {
        try {
          const trimmedSitePlan = await trimSitePlanImage(assessmentData.sitePlanFile);
          const assessmentDataTrimmed = { ...assessmentData, sitePlanFile: trimmedSitePlan };
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const assessmentFooterText = isResidential
            ? `Residential Asbestos Assessment Report: ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}`
            : `Asbestos Assessment Report: ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}`;
          const sitePlanFigureTitle = assessmentData.sitePlanFigureTitle || 'Asbestos Survey Site Plan';
          const sitePlanLetter = hasFibreIdReport ? 'B' : 'A';
          const sitePlanFragment = generateSitePlanContentPage(assessmentDataTrimmed, sitePlanLetter, logoBase64, assessmentFooterText, 'sitePlanFile', 'SITE PLAN', sitePlanFigureTitle, 'sitePlanLegend', 'sitePlanLegendTitle');
          const sitePlanCss = `
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }
          @page { size: A4 landscape; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; height: 100%; font-family: "Gothic", Arial, sans-serif; color: #222; background: #fff; }
          .page { width: 100%; height: 100%; position: relative; background: #fff; margin: 0; padding: 0; }
          .site-plan-page { height: 100%; display: flex; flex-direction: column; min-height: 0; overflow: hidden; page-break-after: avoid; page-break-inside: avoid; }
          .site-plan-page .header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; font-family: "Gothic", Arial, sans-serif; }
          .site-plan-page .green-line { flex-shrink: 0; width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
          .site-plan-page .content { flex: 1; min-height: 0; overflow: hidden; padding: 5px 0 10px 0; display: flex; flex-direction: column; }
          .site-plan-page .footer { flex-shrink: 0; position: relative; left: 0; right: 0; bottom: 0; width: 100%; padding: 0 48px 16px 48px; text-align: justify; font-size: 0.75rem; color: #222; font-family: "Gothic", Arial, sans-serif; }
          .logo { width: 243px; height: auto; display: block; background: #fff; margin: 0; }
          .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; margin-top: 8px; margin: 0; }
          .company-details .website { color: #16b12b; font-weight: 500; }
          .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
          .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
          .footer-text { flex: 1; }
          .site-plan-layout { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: row; justify-content: center; gap: 8px; align-items: flex-start; margin: 0; width: 100%; padding: 0; }
          .site-plan-container { flex: 0 0 auto; width: fit-content; max-width: 85%; min-width: 0; overflow: hidden; display: flex; flex-direction: column; padding: 0; margin: 12px 0 0 0; border: none; background: transparent; border-radius: 0; box-shadow: none; }
          .site-plan-container .site-plan-image-wrapper { flex: 0 0 auto; width: fit-content; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          .site-plan-container .site-plan-image { display: block; width: auto; height: auto; max-width: 100%; max-height: 70vh; object-fit: contain; border: 1px solid #999; box-sizing: border-box; margin: 0; padding: 0; background: transparent; }
          .site-plan-container .site-plan-figure-caption { flex-shrink: 0; font-size: 14px; font-weight: 600; color: #222; text-align: center; margin-top: 8px; font-family: "Gothic", Arial, sans-serif; }
          .site-plan-legend-container { flex-shrink: 0; font-family: "Gothic", Arial, sans-serif; }
          `;
          const sitePlanHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Site Plan</title><style>${sitePlanCss}</style></head><body>${sitePlanFragment}</body></html>`;
          const sitePlanPdf = await docRaptorService.generatePDF(sitePlanHtml);
          merged = await mergePdfBuffers([merged, sitePlanPdf]);
        } catch (error) {
          console.error(`[${pdfId}] Error generating site plan content PDF:`, error);
        }
      } else {
        try {
          merged = await mergePDFs(merged, assessmentData.sitePlanFile);
        } catch (error) {
          console.error(`[${pdfId}] Error merging site plan PDF:`, error);
        }
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', merged.length);
    res.send(merged);
  } catch (error) {
    console.error('Error generating assessment PDF (v3):', error);
    res.status(500).json({ error: error.message });
  }
});

const generateAssessmentHTML = async (assessmentData) => {
  try {
    // Load DocRaptor-optimized templates
    const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
    const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
    const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');
    const asbestosItem1Template = fs.readFileSync(path.join(templateDir, 'AsbestosItem1.html'), 'utf8');
    const asbestosSampleItemTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosSampleItem.html'), 'utf8');
    const asbestosDiscussionConclusionsTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosDiscussionConclusions.html'), 'utf8');
    const asbestosAdditionalSectionsTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosAdditionalSections.html'), 'utf8');
    const asbestosGlossaryTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosGlossary.html'), 'utf8');
    const appendixACoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    
    // Get frontend URL from environment variable (fallback to localhost for development)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Replace [FRONTEND_URL] placeholder in all templates with actual frontend URL
    const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
    const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
    const versionControlTemplateWithUrl = replaceFrontendUrl(versionControlTemplate);
    const asbestosItem1TemplateWithUrl = replaceFrontendUrl(asbestosItem1Template);
    const asbestosSampleItemTemplateWithUrl = replaceFrontendUrl(asbestosSampleItemTemplate);
    const asbestosDiscussionConclusionsTemplateWithUrl = replaceFrontendUrl(asbestosDiscussionConclusionsTemplate);
    const asbestosAdditionalSectionsTemplateWithUrl = replaceFrontendUrl(asbestosAdditionalSectionsTemplate);
    const asbestosGlossaryTemplateWithUrl = replaceFrontendUrl(asbestosGlossaryTemplate);
    const appendixACoverTemplateWithUrl = replaceFrontendUrl(appendixACoverTemplate);
    const appendixBCoverTemplateWithUrl = replaceFrontendUrl(appendixBCoverTemplate);
    
    // Load logo and background images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
    const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Use residential template when isResidential (has Background section and "Summary of Identified ACM")
    const templateType = isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment';
    const templateContent = await getTemplateByType(templateType);
    

    // Assessment cover/version control: match clearance structure (REPORT_TITLE, FOOTER_TEXT, etc.)
    const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
    const assessmentReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT<br />REPORT';
    const assessmentClientName = assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client';
    const assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
    const reportAuthorName = assessmentData.LAA || (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName
      ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : null) || 'Unknown Assessor';
    const reportApprovedBy = assessmentData.reportApprovedBy || assessmentData.reportAuthorisedBy || 'Awaiting authorisation';
    const reportIssueDate = assessmentData.reportAuthorisedAt
      ? new Date(assessmentData.reportAuthorisedAt).toLocaleDateString('en-GB')
      : (assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown');

    const assessmentIntrusivenessLabel = assessmentData.intrusiveness === 'intrusive' || 'non-intrusive';
    // Populate cover template with data (REPORT_TITLE, SITE_ADDRESS, SECONDARY_HEADER, CLIENT_NAME, JOB_REFERENCE, ASSESSMENT_DATE, INTRUSIVENESS, no watermark/footer)
    const populatedCover = coverTemplateWithUrl
      .replace(/\[REPORT_TITLE\]/g, assessmentReportTitle)
      .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
      .replace(/\[SECONDARY_HEADER\]/g, assessmentData.secondaryHeader || '')
      .replace(/\[INTRUSIVENESS\]/g, assessmentIntrusivenessLabel)
      .replace(/\[CLIENT_NAME\]/g, assessmentClientName)
      .replace(/\[JOB_REFERENCE\]/g, assessmentData.projectId?.projectID || 'Unknown')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

    // Populate version control template with data (like clearance: REPORT_TITLE, FOOTER_TEXT, document-details-table, WATERMARK_PATH)
    const versionControlReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT REPORT';
    const versionControlFilename = isResidential
      ? `${assessmentData.projectId?.projectID || 'Unknown'}_Residential_Asbestos_Assessment_Report - ${assessmentData.projectId?.name || 'Unknown'} (${assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown'}).pdf`
      : `${assessmentData.projectId?.projectID || 'Unknown'}_Asbestos_Assessment_Report - ${assessmentData.projectId?.name || 'Unknown'} (${assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown'}).pdf`;
    const populatedVersionControl = versionControlTemplateWithUrl
      .replace(/\[REPORT_TITLE\]/g, versionControlReportTitle)
      .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
      .replace(/\[CLIENT_NAME\]/g, assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[ASSESSOR_NAME\]/g, reportAuthorName)
      .replace(/\[FILENAME\]/g, versionControlFilename)
      .replace(/\[REPORT_APPROVED_BY\]/g, reportApprovedBy)
      .replace(/\[REPORT_ISSUE_DATE\]/g, reportIssueDate)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText);

    // Generate first assessment register item for the main page
    const assessmentItems = assessmentData.items || [];
    const scopeBulletCount = assessmentItems.length;
    const shouldMoveFirstItemToNewPage = scopeBulletCount > 5;
    const firstSampleItem = assessmentItems.length > 0 ? assessmentItems[0] : null;
    const getCommentsValue = (item) => {
      if (hasNoAsbestosContent(item)) return 'No action required';
      let rec = (item.recommendationActions || '').trim();
      const cond = (item.condition || '').trim();
      const mat = (item.materialType || '').trim();
      if (!rec) return 'No comments';
      if (rec === cond) return 'No comments';
      if (mat && cond && rec === `${mat} ${cond}`) return 'No comments';
      // Deduplicate repeated recommendation text (handles "X\n\nX", "X  X", or "X X")
      let parts = rec.split(/\n\n+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length <= 1 && /^(.+)\s\1$/.test(rec.trim())) {
        parts = [rec.replace(/^(.+)\s\1$/, '$1').trim()];
      }
      const seen = new Set();
      const unique = parts.filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; });
      return unique.join('\n\n');
    };
    const isVisuallyAssessed = (ac) => {
      const s = (ac || '').trim();
      return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM' || s === 'Visually Assessed as Asbestos';
    };
    const isNonAsbestos = (ac) => {
      const s = (ac || '').trim();
      return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM';
    };
    const getSampleRefDisplay = (item, fallback) => {
      if (isVisuallyAssessed(item.asbestosContent)) return 'Visually assessed';
      const ref = item.sampleReference || fallback;
      const sampled = findSampledItemForRef(item.sampleReference);
      if (sampled && sampled !== item) return `Refer to sample ${ref}`;
      return ref;
    };
    const getLocationContent = (item) => {
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const parts = [];
      if (item.levelFloor && String(item.levelFloor).trim()) parts.push(esc(item.levelFloor));
      if (item.roomArea && String(item.roomArea).trim()) parts.push(esc(item.roomArea));
      parts.push(esc(item.locationDescription || 'Unknown Location'));
      return parts.join('<br/>');
    };
    // Assessment register: only show Chrysotile/Amosite/Crocidolite asbestos OR No Asbestos Detected (hide organic, SMF, etc.)
    // Derive asbestos content from analytical data (fibres array) when available - matches fibre ID report logic
    // For referred items (same sampleReference as another item), use the sampled item's asbestos content
    const findSampledItemForRef = (ref) => {
      const r = String(ref || '').trim();
      if (!r) return null;
      return assessmentItems.find((i) => (i.sampleReference || '').trim() === r) || null;
    };
    const getAsbestosContentRaw = (item) => {
      if (item.asbestosContent && String(item.asbestosContent).trim()) return item.asbestosContent;
      const ad = item.analysisData;
      if (!ad) {
        // Referred item: no analysisData on this item - use sampled item's content
        const sampled = findSampledItemForRef(item.sampleReference);
        if (sampled && sampled !== item) return getAsbestosContentRaw(sampled);
        return null;
      }
      // Extract asbestos types from fibres array (fibres where result includes 'Asbestos' or UMF)
      if (ad.fibres && Array.isArray(ad.fibres)) {
        const asbestosFromFibres = ad.fibres
          .filter((f) => {
            if (!f || !f.result) return false;
            const r = String(f.result).trim();
            if (!r || /^non[- ]?asbestos$/i.test(r)) return false;
            return /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(r) || /^umf$/i.test(r) || /^unidentified\s+mineral\s+fibre$/i.test(r);
          })
          .map((f) => {
            const r = String(f.result).trim();
            if (/^umf$/i.test(r)) return 'Unidentified Mineral Fibre (UMF)';
            return r;
          });
        if (asbestosFromFibres.length > 0) return [...new Set(asbestosFromFibres)].join(', ');
      }
      // Trace analysis takes priority in finalResult
      const hasTrace = ad.traceAsbestos === 'yes' && ad.traceCount && ad.traceAsbestosContent;
      if (hasTrace || (ad.finalResult && (/^no asbestos detected$/i.test(ad.finalResult) || ad.finalResult.includes('Trace')))) {
        return ad.finalResult;
      }
      if (ad.finalResult) return ad.finalResult;
      return null;
    };
    const isAsbestosType = (p) => /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(String(p).trim()) || /^umf$/i.test(String(p).trim()) || /^unidentified\s+mineral\s+fibre(\s*\(umf\))?$/i.test(String(p).trim());
    const getSampleRegisterAsbestosDisplay = (raw) => {
      const s = String(raw || '').trim();
      if (!s) return 'No Asbestos Detected';
      if (s === 'Visually Assessed as Asbestos') return 'Visually Assessed as Asbestos';
      if (s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-asbestos' || s === 'Visually Assessed as Non-ACM') return 'Visually Assessed as Non-Asbestos';
      if (/^no asbestos detected$/i.test(s)) return 'No Asbestos Detected';
      // Parse comma-separated list (e.g. "Chrysotile Asbestos, Organic fibres") and extract only asbestos types
      const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
      const asbestosTypes = parts.filter(isAsbestosType);
      // Normalise to standard casing for known types
      const normalise = (t) => {
        const lower = t.toLowerCase();
        if (lower.includes('chrysotile')) return 'Chrysotile Asbestos';
        if (lower.includes('amosite')) return 'Amosite Asbestos';
        if (lower.includes('crocidolite')) return 'Crocidolite Asbestos';
        if (lower === 'umf' || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'))) return 'Unidentified Mineral Fibre (UMF)';
        return t;
      };
      const display = asbestosTypes.map(normalise).filter(Boolean);
      if (display.length > 0) return [...new Set(display)].join(', ');
      // Trace result (e.g. "Trace Chrysotile Asbestos detected")
      if (/trace.*detected/i.test(s)) return s;
      // UMF/Unidentified Mineral Fibre (e.g. "Unidentified Mineral Fibre detected" from trace 100+ visible)
      if (/unidentified\s+mineral\s+fibre|^umf(\s|$)/i.test(s)) return /trace/i.test(s) ? s : (/detected/i.test(s) ? 'Unidentified Mineral Fibre (UMF) detected' : 'Unidentified Mineral Fibre (UMF)');
      return 'No Asbestos Detected';
    };
    const getAsbestosContentHtml = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || item.asbestosContent || 'Not tested';
      const displayText = getSampleRegisterAsbestosDisplay(raw);
      const isNonAsbestosDisplay = displayText === 'No Asbestos Detected' || displayText === 'Visually Assessed as Non-Asbestos';
      const cls = isNonAsbestosDisplay ? 'asbestos-content-non-asbestos' : 'asbestos-content-asbestos';
      const safe = displayText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<span class="${cls}">${safe}</span>`;
    };
    const hasNoAsbestosContent = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
      const display = getSampleRegisterAsbestosDisplay(raw);
      return display === 'No Asbestos Detected' || display === 'Visually Assessed as Non-Asbestos';
    };
    const getAsbestosTypeDisplay = (item) => {
      if (hasNoAsbestosContent(item)) return '-';
      const at = (item.asbestosType || '').toLowerCase();
      if (at === 'friable') return 'Friable';
      if (at === 'non-friable') return 'Non-friable';
      return item.asbestosType || '-';
    };
    const getConditionDisplay = (item) => hasNoAsbestosContent(item) ? '-' : (item.condition || 'Unknown');
    const getRiskDisplay = (item) => hasNoAsbestosContent(item) ? '-' : (item.risk || 'Unknown');
    const getItemNumber = (items, idx) => {
      const item = items[idx];
      if (!item) return '-';
      if (hasNoAsbestosContent(item)) return '-';
      const count = items.slice(0, idx + 1).filter((i) => !hasNoAsbestosContent(i)).length;
      return String(count);
    };
    // Multiple images per item: include all photos marked includeInReport; fallback to legacy single photograph; one table per photo with identical item info
    const getIncludedPhotoSources = (item) => {
      const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false).map(p => (p.data || '').trim()).filter(Boolean);
      if (fromArray.length > 0) return fromArray;
      const legacy = (item.photograph || '').trim();
      if (legacy) return [legacy];
      return [null];
    };
    const getSamplePhotoCellHtmlFromSrc = (photoSrc) => {
      let src = photoSrc || '';
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
        src = frontendUrl + src;
      }
      if (src) {
        const safe = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<div class="sample-photo-cell-inner"><img class="sample-photo" src="${safe}" alt="" /></div>`;
      }
      return '<div class="sample-photo-cell-inner"><div class="sample-no-photo">No photograph available</div></div>';
    };
    const buildTableBlock = (block) => {
      const { item, itemIndex, photoSrc } = block;
      return asbestosSampleItemTemplateWithUrl
        .replace(/\[PHOTO_CELL\]/g, getSamplePhotoCellHtmlFromSrc(photoSrc))
        .replace(/\[ITEM_NUMBER\]/g, getItemNumber(assessmentItems, itemIndex))
        .replace(/\[SAMPLE_REFERENCE\]/g, getSampleRefDisplay(item, `Sample ${itemIndex + 1}`))
        .replace(/\[LOCATION_DESCRIPTION\]/g, getLocationContent(item))
        .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
        .replace(/\[ASBESTOS_CONTENT\]/g, getAsbestosContentHtml(item))
        .replace(/\[ASBESTOS_TYPE\]/g, getAsbestosTypeDisplay(item))
        .replace(/\[CONDITION\]/g, getConditionDisplay(item))
        .replace(/\[RISK\]/g, getRiskDisplay(item))
        .replace(/\[COMMENTS\]/g, getCommentsValue(item));
    };
    const tableBlocks = [];
    assessmentItems.forEach((item, itemIndex) => {
      const sources = getIncludedPhotoSources(item);
      sources.forEach(photoSrc => tableBlocks.push({ item, itemIndex, photoSrc }));
    });
    const firstSampleTable = tableBlocks.length > 0 ? buildTableBlock(tableBlocks[0]) : '';

    // Generate assessment register items as separate pages (one table per photo, 2 tables per page)
    let sampleRegisterPages = '';
    
    if (shouldMoveFirstItemToNewPage) {
      // For 6+ items: all table blocks on separate pages, 2 per page
      const blocksForPages = tableBlocks;
      const pages = [];
      for (let i = 0; i < blocksForPages.length; i += 2) {
        const pageBlocks = blocksForPages.slice(i, i + 2);
        const pageContent = pageBlocks.map(block => buildTableBlock(block)).join('<div style="margin-bottom: 20px;"></div>');
        const continuationHeader = i >= 2 && i % 2 === 0
          ? '<div class="section-header">TABLE 1: ASSESSMENT REGISTER cont.</div>'
          : '';
        const pageNumber = 2 + pages.length;
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${continuationHeader}
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-border-line"></div>
              <div class="footer-content">
                <div class="footer-text">${assessmentFooterText}</div>
                <div class="page-number">${pageNumber}</div>
              </div>
            </div>
          </div>
        `);
      }
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    } else {
      // For ≤5 items: first table block on page 1, remaining blocks 2 per page
      const remainingBlocks = tableBlocks.slice(1);
      const pages = [];
      for (let i = 0; i < remainingBlocks.length; i += 2) {
        const pageBlocks = remainingBlocks.slice(i, i + 2);
        const pageContent = pageBlocks.map(block => buildTableBlock(block)).join('<div style="margin-bottom: 20px;"></div>');
        const continuationHeader = '<div class="section-header">TABLE 1: ASSESSMENT REGISTER cont.</div>';
        const pageNumber = 2 + pages.length;
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${continuationHeader}
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-border-line"></div>
              <div class="footer-content">
                <div class="footer-text">${assessmentFooterText}</div>
                <div class="page-number">${pageNumber}</div>
              </div>
            </div>
          </div>
        `);
      }
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    }


    
    // Survey findings: use No Asbestos content when no asbestos items; otherwise use main survey findings content
    const hasAsbestosItems = assessmentItems.some((item) => !hasNoAsbestosContent(item));
    const surveyFindingsSource = hasAsbestosItems
      ? (templateContent?.standardSections?.surveyFindingsContent || 'Survey findings content not found')
      : (templateContent?.standardSections?.surveyFindingsContentNoSamples || "No asbestos-containing materials were identified during this assessment.");
    let surveyFindingsContentPopulated = surveyFindingsSource !== 'Survey findings content not found'
      ? await replacePlaceholders(surveyFindingsSource, { ...assessmentData, selectedLegislation: templateContent?.selectedLegislation || [] })
      : surveyFindingsSource;
    const hasSitePlan = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
    const hasFibreIdReport = !!assessmentData.fibreAnalysisReport;
    const sitePlanAppendix = hasFibreIdReport ? 'Appendix B' : 'Appendix A';
    if (hasSitePlan) {
      surveyFindingsContentPopulated += `\n\nA site plan illustrating the locations of asbestos-containing materials for this assessment is presented in ${sitePlanAppendix} of this report.`;
    }
    // Ensure newlines render in HTML (replacePlaceholders may not convert \n)
    surveyFindingsContentPopulated = surveyFindingsContentPopulated.replace(/\n/g, '<br />');

    // Background section (residential template only): before Introduction
    let backgroundSectionHtmlResolved = '';
    const backgroundContentRaw = templateContent?.standardSections?.backgroundContent;
    if (isResidential && backgroundContentRaw) {
      const bgTitle = templateContent?.standardSections?.backgroundTitle || 'BACKGROUND';
      const bgContent = await replacePlaceholders(backgroundContentRaw, { ...assessmentData, selectedLegislation: templateContent?.selectedLegislation || [] });
      const bgContentHtml = String(bgContent || '').replace(/\n/g, '<br />');
      backgroundSectionHtmlResolved = `<div class="section-header first-section">${bgTitle}</div><div class="paragraph">${bgContentHtml}</div>`;
    }

    // Populate AsbestosItem1 template with dynamic content (footer matches VersionControl; page number 1)
    const populatedAsbestosItem1 = asbestosItem1TemplateWithUrl
      .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, '1')
      .replace(/\[BACKGROUND_SECTION\]/g, backgroundSectionHtmlResolved)
      .replace(/\[INTRODUCTION_TITLE\]/g, templateContent?.standardSections?.introductionTitle || 'INTRODUCTION')
      .replace(/\[INTRODUCTION_CONTENT\]/g, templateContent?.standardSections?.introductionContent ? await replacePlaceholders(templateContent.standardSections.introductionContent, { ...assessmentData, selectedLegislation: templateContent?.selectedLegislation || [] }) : 'Introduction content not found')
      .replace(/\[SURVEY_FINDINGS_TITLE\]/g, templateContent?.standardSections?.surveyFindingsTitle || 'SUMMARY OF IDENTIFIED ACM')
      .replace(/\[SURVEY_FINDINGS_CONTENT\]/g, surveyFindingsContentPopulated)
      .replace(/\[SAMPLE_REGISTER_ITEMS\]/g, shouldMoveFirstItemToNewPage ? '' : firstSampleTable); // Conditionally include the first sample table

    // Populate Discussion and Conclusions template: asbestos items, then non-asbestos items
    // Use same effective asbestos display logic as sample tables (includes fibres array, referred items)
    const getEffectiveAsbestosDisplayForDiscussion = (item) => {
      const sampled = findSampledItemForRef(item.sampleReference);
      const sourceItem = (sampled && sampled !== item) ? sampled : item;
      const raw = getAsbestosContentRaw(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
      return getSampleRegisterAsbestosDisplay(raw);
    };
    const getDiscussionDisplay = (item) => getEffectiveAsbestosDisplayForDiscussion(item);
    const isAsbestosForDiscussion = (display) => display !== 'No Asbestos Detected' && display !== 'Visually Assessed as Non-Asbestos';
    const identifiedAsbestosItems = assessmentItems.filter(item => isAsbestosForDiscussion(getDiscussionDisplay(item)));
    const identifiedNonAsbestosItems = assessmentItems.filter(item => !isAsbestosForDiscussion(getDiscussionDisplay(item)));

    const discussionDisplayContentLabel = (item) => {
      const display = getEffectiveAsbestosDisplayForDiscussion(item);
      if (display === 'No Asbestos Detected') return 'No asbestos detected';
      return display;
    };

    const isUMFOnly = (item) => {
      const display = getEffectiveAsbestosDisplayForDiscussion(item);
      if (!display || display === 'No Asbestos Detected') return false;
      const lower = String(display).toLowerCase();
      const hasUMF = lower.includes('umf') || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'));
      const hasConfirmedAsbestos = lower.includes('chrysotile') || lower.includes('amosite') || lower.includes('crocidolite');
      return hasUMF && !hasConfirmedAsbestos;
    };

    const formatDiscussionListItem = (item) => {
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const roomArea = esc(item.roomArea || 'Not specified');
      const loc = esc(item.locationDescription || 'Unknown Location');
      const visuallyAssessed = isVisuallyAssessed(item.asbestosContent);
      const base = `${roomArea} - ${loc}`;
      const suffix = isUMFOnly(item) ? ' *' : '';
      return (visuallyAssessed ? `${base} (Visually assessed)` : base) + suffix;
    };
    const hasUMFOnlyItems = identifiedAsbestosItems.some(isUMFOnly);
    const umfFootnote = hasUMFOnlyItems
      ? '<div class="paragraph umf-footnote" style="font-style: italic; margin-top: 8px;"><em>* Item was found to contain Unidentified Mineral Fibre (UMF). Material should be considered to be asbestos unless further analysis can confirm otherwise.</em></div>'
      : '';
    const asbestosItemsSection = identifiedAsbestosItems.length > 0
      ? `<ul class="asbestos-list">${identifiedAsbestosItems.map(item => `<li>${formatDiscussionListItem(item)}</li>`).join('')}</ul>${umfFootnote}`
      : '<div class="paragraph">No asbestos items were identified during the assessment.</div>';

    const nonAsbestosItemsSection = identifiedNonAsbestosItems.length > 0
      ? `<ul class="non-asbestos-list">${identifiedNonAsbestosItems.map(item => `<li>${formatDiscussionListItem(item)}</li>`).join('')}</ul>`
      : '<div class="paragraph">No non-asbestos items were identified during the assessment.</div>';

    const asbestosCount = identifiedAsbestosItems.length;
    const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
    const hasSampledItemsRequiringAnalysis = assessmentItems.some((i) => (i.sampleReference || '').trim() && !isVisuallyAssessed(i.asbestosContent));
    const firstSampledPerRef = hasSampledItemsRequiringAnalysis
      ? assessmentItems.filter((item, index) => {
          if (!(item.sampleReference || '').trim() || isVisuallyAssessed(item.asbestosContent)) return false;
          const ref = item.sampleReference.trim();
          return index === assessmentItems.findIndex((i) => (i.sampleReference || '').trim() === ref);
        })
      : [];
    const analysisComplete = assessmentData.status === 'sample-analysis-complete' ||
      !hasSampledItemsRequiringAnalysis ||
      firstSampledPerRef.every((i) => i.analysisData?.isAnalysed === true);
    const asbestosCountDisplay = asbestosCount > 0 ? formatAsbestosCountForPdf(asbestosCount, analysisComplete) : String(asbestosCount);
    const acmRemovalSentence = 'ACM should be removed prior to the commencement of works which may damage or disturb the material.';
    const defaultDiscussionText = asbestosCount === 0
      ? `No asbestos containing materials were identified during the assessment conducted at ${siteName}.`
      : `${asbestosCountDisplay} asbestos items were identified during the assessment of ${siteName}.\n\n${acmRemovalSentence}`;
    let discussionConclusionsRaw = (assessmentData.discussionConclusions || '').trim() || defaultDiscussionText;
    const analysisIncompleteReplacement = formatAsbestosCountForPdf(asbestosCount, analysisComplete);
    discussionConclusionsRaw = discussionConclusionsRaw
      .replace(/\{ANALYSIS INCOMPLETE\}/g, analysisIncompleteReplacement)
      .replace(/\{ANALYSIS_INCOMPLETE\}/g, analysisIncompleteReplacement);
    const discussionConclusionsHtml = toJustifiedParagraphsHtml(discussionConclusionsRaw);

    // Page numbers: cover=1, version=2, item1=3, then assessment register pages, then discussion, then optional RCM page, then additional 1 & 2
    const sampleRegisterPageCount = shouldMoveFirstItemToNewPage
      ? Math.ceil((assessmentItems.length || 0) / 2)
      : Math.ceil(Math.max(0, (assessmentItems.length || 1) - 1) / 2);
    const discussionPageNum = 4 + sampleRegisterPageCount;

    const templateData = { ...assessmentData, identifiedAsbestosItems: asbestosItemsSection, selectedLegislation: templateContent?.selectedLegislation || [] };
    const discussionSignOffContent = templateContent?.standardSections?.signOffContent
      ? await replacePlaceholders(templateContent.standardSections.signOffContent, templateData)
      : '';
    const discussionSignatureContent = templateContent?.standardSections?.signaturePlaceholder
      ? await replacePlaceholders(templateContent.standardSections.signaturePlaceholder, templateData)
      : '';

    const jobSpecificExclusionsRawTemplate = (assessmentData.jobSpecificExclusions || '').trim();
    const jobSpecificExclusionsHtmlTemplate = toJustifiedParagraphsHtml(jobSpecificExclusionsRawTemplate);

    const populatedDiscussionConclusions = asbestosDiscussionConclusionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ASBESTOS_ITEMS_SECTION\]/g, asbestosItemsSection)
      .replace(/\[NON_ASBESTOS_ITEMS_SECTION\]/g, nonAsbestosItemsSection)
      .replace(/\[DISCUSSION_CONCLUSIONS_CONTENT\]/g, discussionConclusionsHtml)
      .replace(/\[SIGN_OFF_CONTENT\]/g, discussionSignOffContent)
      .replace(/\[SIGNATURE_IMAGE\]/g, discussionSignatureContent)
      .replace(/\[JOB_SPECIFIC_EXCLUSIONS\]/g, jobSpecificExclusionsHtmlTemplate)
      .replace(/\[LAA_NAME\]/g, assessmentData.assessorId?.firstName ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : 'Unknown Assessor')
      .replace(/\[LAA_LICENCE\]/g, 'AA00031') // Default license - will be looked up in replacePlaceholders
      .replace(/\[SITE_NAME\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(discussionPageNum))
      .replace(/\[DISCUSSION_TITLE\]/g, templateContent?.standardSections?.discussionTitle || 'DISCUSSION AND CONCLUSIONS')
      .replace(/\[DISCUSSION_CONTENT\]/g, templateContent?.standardSections?.discussionContent ? await replacePlaceholders(templateContent.standardSections.discussionContent, templateData) : 'Discussion and conclusions content not found');



    // Generate two pages of additional sections with proper content distribution
    // Order: Assessment Methodology, Recommended Control Measures (own page), Risk, Control Measures, Remediation, Legislation, Limitations
    const sections = [
      {
        title: templateContent?.standardSections?.assessmentMethodologyTitle || 'ASSESSMENT METHODOLOGY',
        content: templateContent?.standardSections?.assessmentMethodologyContent ? await replacePlaceholders(templateContent.standardSections.assessmentMethodologyContent, templateData) : ''
      },
      {
        title: templateContent?.standardSections?.recommendedControlMeasuresTitle || 'RECOMMENDED CONTROL MEASURES',
        content: templateContent?.standardSections?.recommendedControlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.recommendedControlMeasuresContent, templateData) : ''
      },
      {
        title: templateContent?.standardSections?.riskAssessmentTitle || 'RISK ASSESSMENT',
        content: templateContent?.standardSections?.riskAssessmentContent ? await replacePlaceholders(templateContent.standardSections.riskAssessmentContent, templateData) : 'Risk assessment content not found'
      },
      {
        title: templateContent?.standardSections?.controlMeasuresTitle || 'DETERMINING SUITABLE CONTROL MEASURES',
        content: templateContent?.standardSections?.controlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.controlMeasuresContent, templateData) : 'Control measures content not found'
      },
      {
        title: templateContent?.standardSections?.remediationRequirementsTitle || 'REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM',
        content: templateContent?.standardSections?.remediationRequirementsContent ? await replacePlaceholders(templateContent.standardSections.remediationRequirementsContent, templateData) : 'Remediation requirements content not found'
      },
      {
        title: templateContent?.standardSections?.legislationTitle || 'LEGISLATION',
        content: templateContent?.standardSections?.legislationContent ? await replacePlaceholders(templateContent.standardSections.legislationContent, templateData) : 'Legislation content not found'
      },
      {
        title: templateContent?.standardSections?.assessmentLimitationsTitle || 'ASSESSMENT LIMITATIONS/CAVEATS',
        content: templateContent?.standardSections?.assessmentLimitationsContent ? await replacePlaceholders(templateContent.standardSections.assessmentLimitationsContent, templateData) : 'Assessment limitations content not found'
      }
    ];

    // Sign-off and signature are on the Discussion/Conclusions page, not in additional sections

    // Convert content to HTML format
    const convertContentToHtml = (content) => {
      const lines = content.split('\n');
      let html = '';
      let inBulletList = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('•')) {
          if (!inBulletList) {
            html += '<ul class="bullet-list">';
            inBulletList = true;
          }
          html += `<li>${line.substring(1).trim()}</li>`;
        } else if (line === '') {
          if (inBulletList) {
            html += '</ul>';
            inBulletList = false;
          }
          html += '<br />';
        } else {
          if (inBulletList) {
            html += '</ul>';
            inBulletList = false;
          }
          html += `<div class="paragraph">${line}</div>`;
        }
      }
      
      if (inBulletList) {
        html += '</ul>';
      }
      
      return html;
    };

    // Split remediation requirements content so the last paragraph is on page 2 with Legislation
    // Content may use <br> (from replacePlaceholders) or \n
    // sections[4] = Remediation (Assessment Methodology=0, Recommended Control Measures=1, Risk=2, Control Measures=3, Remediation=4, Legislation=5, Limitations=6)
    const remediationSection = sections[4];
    let remediationContentPage1 = remediationSection.content;
    let remediationContentPage2 = '';
    const followingCompletionText = 'Following Completion of Asbestos Removal Works';
    if (remediationSection.content.includes(followingCompletionText)) {
      const splitIndex = remediationSection.content.indexOf(followingCompletionText);
      remediationContentPage1 = remediationSection.content.substring(0, splitIndex).replace(/(<br>\s*)+$|\n+$/, '');
      remediationContentPage2 = remediationSection.content.substring(splitIndex);
    }

    // First additional page: Assessment Methodology, Risk Assessment, first part of Remediation
    const firstPageContent = [
      `<div class="section-header">${sections[0].title}</div>${convertContentToHtml(sections[0].content)}`,
      `<div class="section-header">${sections[2].title}</div>${convertContentToHtml(sections[2].content)}`,
      `<div class="section-header">${remediationSection.title}</div>${convertContentToHtml(remediationContentPage1)}`
    ].join('');

    // Second additional page: remaining remediation content + Legislation + Limitations
    const secondPageContent = [
      ...(remediationContentPage2 ? [`<div class="section-header">${remediationSection.title}</div>${convertContentToHtml(remediationContentPage2)}`] : []),
      ...sections.slice(5).map(section =>
        `<div class="section-header">${section.title}</div>${convertContentToHtml(section.content)}`
      )
    ].join('');

    // Recommended Control Measures gets its own page after Discussion when it has content
    const hasRcmPage = !!(sections[1].content && String(sections[1].content).trim());
    const recommendedControlMeasuresPageNum = discussionPageNum + 1;
    const additionalSection1PageNum = discussionPageNum + (hasRcmPage ? 2 : 1);
    const additionalSection2PageNum = additionalSection1PageNum + 1;

    const rcmPageContent = `<div class="section-header">${sections[1].title}</div>${convertContentToHtml(sections[1].content)}`;
    const populatedRecommendedControlMeasures = hasRcmPage
      ? asbestosAdditionalSectionsTemplateWithUrl
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, rcmPageContent)
          .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
          .replace(/\[PAGE_NUMBER\]/g, String(recommendedControlMeasuresPageNum))
      : '';

    const populatedAdditionalSectionsPage1 = asbestosAdditionalSectionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, firstPageContent)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(additionalSection1PageNum));

    const populatedAdditionalSectionsPage2 = asbestosAdditionalSectionsTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, secondPageContent)
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(additionalSection2PageNum));

    // Glossary page: fetch glossary custom data and build table (same header/footer as Discussion Conclusions, page number after additional sections)
    const glossaryPageNum = additionalSection2PageNum + 1;
    let glossaryTableRows = '';
    try {
      const glossaryItems = await CustomDataFieldGroup.getFieldsByType('glossary');
      const sorted = (glossaryItems || []).slice().sort((a, b) => {
        const nameA = (a.name || a.text || '').trim().toLowerCase();
        const nameB = (b.name || b.text || '').trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
      glossaryTableRows = sorted.map((item) => {
        const term = (item.name || item.text || '').trim();
        const definition = (item.text || '').trim();
        const termEscaped = term.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const definitionEscaped = definition.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
        return `<tr><td class="glossary-term">${termEscaped}</td><td class="glossary-definition">${definitionEscaped}</td></tr>`;
      }).join('');
    } catch (err) {
      console.warn(`[generateAssessmentHTML] Could not load glossary:`, err.message);
    }
    const populatedGlossaryPage = asbestosGlossaryTemplateWithUrl
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[GLOSSARY_TABLE_ROWS\]/g, glossaryTableRows || '<tr><td colspan="2" class="glossary-definition">No glossary terms have been defined.</td></tr>')
      .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
      .replace(/\[PAGE_NUMBER\]/g, String(glossaryPageNum));

    // Generate dynamic appendix content
    let appendixContent = '';

    // Add Certificate of Analysis cover page only when there are samples (fibre ID report attachment)
    if (assessmentData.fibreAnalysisReport) {
      const populatedAppendixACover = appendixACoverTemplateWithUrl
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

      appendixContent += `
          <!-- Appendix A Cover Page - Certificate of Analysis -->
          ${populatedAppendixACover}
      `;

      // Note: Analysis certificate content is now handled by merging the fibre analysis report PDF
      // No need to generate HTML content here
    }

    // Add site plan if it exists (Appendix A when no fibre ID report, Appendix B when fibre ID report exists)
    if (assessmentData.sitePlan && assessmentData.sitePlanFile) {
      const sitePlanAppendixLetterLegacy = assessmentData.fibreAnalysisReport ? 'B' : 'A';
      const populatedAppendixBCover = appendixBCoverTemplateWithUrl
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
        .replace(/\[APPENDIX_LETTER\]/g, sitePlanAppendixLetterLegacy);

      appendixContent += `
          <!-- Appendix ${sitePlanAppendixLetterLegacy} Cover Page (Site Plan) -->
          ${populatedAppendixBCover}
      `;

      // Add site plan content page if it's an image
      const isSitePlanImage = assessmentData.sitePlanFile && (
        assessmentData.sitePlanFile.startsWith('/9j/') || 
        assessmentData.sitePlanFile.startsWith('iVBORw0KGgo') ||
        assessmentData.sitePlanFile.startsWith('data:image/')
      );

      if (isSitePlanImage) {
        const trimmedSitePlan = await trimSitePlanImage(assessmentData.sitePlanFile);
        const assessmentDataTrimmed = { ...assessmentData, sitePlanFile: trimmedSitePlan };
        const sitePlanFigureTitle = assessmentData.sitePlanFigureTitle || 'Asbestos Survey Site Plan';
        const sitePlanContentPage = generateSitePlanContentPage(assessmentDataTrimmed, sitePlanAppendixLetterLegacy, logoBase64, assessmentFooterText, 'sitePlanFile', 'SITE PLAN', sitePlanFigureTitle, 'sitePlanLegend', 'sitePlanLegendTitle');
        appendixContent += `
            <!-- Appendix ${sitePlanAppendixLetterLegacy} Site Plan Content Page -->
            ${sitePlanContentPage}
        `;
      }
    }

    // Shared styles for assessment-page fragments (assessment register pages use same header/footer as AsbestosItem1)
    const assessmentPageSharedStyles = `
      .assessment-page { width: 100%; min-height: 100vh; position: relative; background: #fff; margin: 0; padding: 0; }
      .assessment-page .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 48px 0 48px; margin: 0; }
      .assessment-page .logo { width: 243px; height: auto; display: block; background: #fff; margin: 0; }
      .assessment-page .company-details { text-align: right; font-size: 0.75rem; color: #222; line-height: 1.5; margin-top: 8px; margin: 0; }
      .assessment-page .company-details .website { color: #16b12b; font-weight: 500; }
      .assessment-page .green-line { width: calc(100% - 96px); height: 1.5px; background: #16b12b; margin: 8px auto 0 auto; border-radius: 0; }
      .assessment-page .content { padding: 10px 48px 24px 48px; flex: 1; display: flex; flex-direction: column; justify-content: flex-start; margin: 0; }
      .assessment-page .footer { position: absolute; left: 0; right: 0; bottom: 16px; width: calc(100% - 96px); margin: 0 auto; text-align: justify; font-size: 0.75rem; color: #222; }
      .assessment-page .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
      .assessment-page .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
      .assessment-page .footer-text { flex: 1; }
      .assessment-page .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
      .assessment-page .sample-register-header { font-size: 0.9rem; font-weight: 700; margin: 8px 0 12px 0; color: #222; }
      .assessment-page .sample-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; table-layout: fixed; font-size: 0.64rem; }
      .assessment-page .sample-table th, .assessment-page .sample-table td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
      .assessment-page .sample-table th { background: #f5f5f5; font-weight: 700; text-align: left; }
      .assessment-page .sample-photo-cell { width: 71% !important; height: 340px !important; overflow: hidden !important; box-sizing: border-box !important; text-align: center; vertical-align: middle; background: #fff; padding: 0 !important; margin: 0 !important; }
      .assessment-page .sample-photo-cell-inner { display: block; width: 100%; height: 340px; overflow: hidden; box-sizing: border-box; padding: 0; margin: 0; }
      .assessment-page .sample-photo-cell-inner .sample-photo { display: block !important; width: 100% !important; height: 100% !important; object-fit: contain !important; object-position: center !important; padding: 0 !important; }
      .assessment-page .sample-photo { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; padding: 0; }
      .assessment-page .sample-label { font-weight: 700; width: 12.5%; background: #f5f5f5; }
      .assessment-page .sample-ref-label { width: 13.75%; }
      .assessment-page .sample-ref-value { width: 11.25%; }
      .assessment-page .sample-value { width: 12.5%; }
      .assessment-page .sample-asbestos-content-cell { font-weight: bold; }
      .assessment-page .sample-risk-cell { line-height: 1; height: 1.2em; padding: 4px 8px; vertical-align: middle; }
      .assessment-page .sample-location-content { height: 60px; vertical-align: top; padding: 8px; background: #fafafa; border: 1.5px solid #888; font-size: 0.64rem; line-height: 1.4; }
      .assessment-page .comments-row td { background: #eaeaea; font-size: 0.64rem; font-style: italic; width: 100%; line-height: 1.4; }
      .assessment-page .comments-cell-inner { min-height: 2.7rem; display: block; }
      .assessment-page .sample-no-photo { display: flex; align-items: center; justify-content: center; min-height: 340px; height: 100%; color: #666; font-style: italic; font-size: 0.64rem; }
      .assessment-page .asbestos-content-asbestos { color: #c62828; }
      .assessment-page .asbestos-content-non-asbestos { color: #2e7d32; }
    `;

    // Create complete HTML document
    const completeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asbestos Assessment Report</title>
        <style>
          /* Force page breaks between sections */
          .page-break {
            page-break-before: always;
            height: 0;
            margin: 0;
            padding: 0;
          }
          /* Shared styles for assessment register pages (match AsbestosItem1 / VersionControl header and footer; body 0.8rem) */
          ${assessmentPageSharedStyles}
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        ${populatedCover}
        <div class="page-break"></div>
        
        <!-- Version Control Page -->
        ${populatedVersionControl}
        <div class="page-break"></div>
        
        <!-- Asbestos Assessment Content Page -->
        ${populatedAsbestosItem1}
        <div class="page-break"></div>
        
        <!-- Assessment Register Pages -->
        ${sampleRegisterPages}
        <div class="page-break"></div>
        
        <!-- Discussion and Conclusions Page -->
        ${populatedDiscussionConclusions}
        <div class="page-break"></div>
        ${hasRcmPage ? `<!-- Recommended Control Measures Page -->\n        ${populatedRecommendedControlMeasures}\n        <div class="page-break"></div>\n        ` : ''}
        <!-- Additional Sections Page 1 -->
        ${populatedAdditionalSectionsPage1}
        <div class="page-break"></div>
        
        <!-- Additional Sections Page 2 -->
        ${populatedAdditionalSectionsPage2}
        <div class="page-break"></div>
        
        <!-- Glossary of Terms Page (before Appendix A) -->
        ${populatedGlossaryPage}
        <div class="page-break"></div>
        
        <!-- Appendix Section -->
        ${appendixContent}
      </body>
      </html>
    `;

    return completeHTML;
  } catch (error) {
    console.error('Error generating assessment HTML:', error);
    throw new Error(`Failed to generate assessment HTML: ${error.message}`);
  }
};

/**
 * V3 (experimental): Cover + Version Control only, using existing templates unchanged.
 * This keeps the legacy layout for the opening pages while we test flow pagination for the rest.
 */
const generateAssessmentCoverVersionHTMLV3 = async (assessmentData, isResidential = false) => {
  // Load DocRaptor-optimized templates (existing)
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
  const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const replaceFrontendUrl = (template) => template.replace(/\[FRONTEND_URL\]/g, frontendUrl);
  const coverTemplateWithUrl = replaceFrontendUrl(coverTemplate);
  const versionControlTemplateWithUrl = replaceFrontendUrl(versionControlTemplate);

  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';

  const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
  const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

  const templateType = isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment';
  const templateContent = await getTemplateByType(templateType);

  const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  const assessmentReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : 'ASBESTOS ASSESSMENT<br />REPORT';
  const assessmentClientName = assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client';
  const assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
  const reportAuthorName = assessmentData.LAA || (assessmentData.assessorId?.firstName && assessmentData.assessorId?.lastName
    ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : null) || 'Unknown Assessor';
  const reportApprovedBy = assessmentData.reportApprovedBy || assessmentData.reportAuthorisedBy || 'Awaiting authorisation';
  const reportIssueDate = assessmentData.reportAuthorisedAt
    ? new Date(assessmentData.reportAuthorisedAt).toLocaleDateString('en-GB')
    : (assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown');

  const versionControlReportTitle = isResidential ? 'RESIDENTIAL ASBESTOS ASSESSMENT REPORT' : (templateContent?.reportTitle || 'ASBESTOS ASSESSMENT REPORT');
  const versionControlFilename = isResidential
    ? `${assessmentData.projectId?.projectID || 'Unknown'}_Residential_Asbestos_Assessment_Report - ${assessmentSiteAddress} (${assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown'}).pdf`
    : `${assessmentData.projectId?.projectID || 'Unknown'}_Asbestos_Assessment_Report - ${assessmentSiteAddress} (${assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown'}).pdf`;

  const assessmentIntrusivenessLabelV3 = assessmentData.intrusiveness === 'intrusive' || 'non-intrusive';
  const populatedCover = coverTemplateWithUrl
    .replace(/\[REPORT_TITLE\]/g, assessmentReportTitle)
    .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
    .replace(/\[SECONDARY_HEADER\]/g, assessmentData.secondaryHeader || '')
    .replace(/\[INTRUSIVENESS\]/g, assessmentIntrusivenessLabelV3)
    .replace(/\[CLIENT_NAME\]/g, assessmentClientName)
    .replace(/\[JOB_REFERENCE\]/g, assessmentData.projectId?.projectID || 'Unknown')
    .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

  const populatedVersionControl = versionControlTemplateWithUrl
    .replace(/\[REPORT_TITLE\]/g, versionControlReportTitle)
    .replace(/\[SITE_ADDRESS\]/g, assessmentSiteAddress)
    .replace(/\[CLIENT_NAME\]/g, assessmentData.projectId?.client?.name || assessmentClientName)
    .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
    .replace(/\[ASSESSOR_NAME\]/g, reportAuthorName)
    .replace(/\[FILENAME\]/g, versionControlFilename)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[FOOTER_TEXT\]/g, assessmentFooterText)
    .replace(/\[REPORT_APPROVED_BY\]/g, reportApprovedBy)
    .replace(/\[REPORT_ISSUE_DATE\]/g, reportIssueDate);

  return `${populatedCover}<div class="page-break"></div>${populatedVersionControl}`;
};

/**
 * V3 (experimental): Flow-based asbestos assessment body with running header/footer and auto pagination.
 * Keeps existing templates intact by not reusing the fixed-height "page" wrappers.
 */
const generateAssessmentFlowHTMLV3 = async (assessmentData, isResidential = false) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const templateType = isResidential ? 'residentialAsbestosAssessment' : 'asbestosAssessment';
  const templateContent = await getTemplateByType(templateType);

  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

  const assessmentSiteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  const assessmentFooterText = isResidential ? `Residential Asbestos Assessment Report: ${assessmentSiteAddress}` : `Asbestos Assessment Report: ${assessmentSiteAddress}`;
  const assessmentJurisdiction = assessmentData.state === 'Commonwealth' ? 'ACT' : assessmentData.state;

  // Helpers (reuse existing behavior)
  const assessmentItems = assessmentData.items || [];
  const getCommentsValue = (item) => {
    if (hasNoAsbestosContentFlow(item)) return 'No action required';
    let rec = (item.recommendationActions || '').trim();
    const cond = (item.condition || '').trim();
    const mat = (item.materialType || '').trim();
    if (!rec) return 'No comments';
    if (rec === cond) return 'No comments';
    if (mat && cond && rec === `${mat} ${cond}`) return 'No comments';
    // Deduplicate repeated recommendation text (handles "X\n\nX", "X  X", or "X X")
    let parts = rec.split(/\n\n+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1 && /^(.+)\s\1$/.test(rec.trim())) {
      parts = [rec.replace(/^(.+)\s\1$/, '$1').trim()];
    }
    const seen = new Set();
    const unique = parts.filter((p) => { if (seen.has(p)) return false; seen.add(p); return true; });
    return unique.join('\n\n');
  };
  const isVisuallyAssessed = (ac) => {
    const s = (ac || '').trim();
    return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM' || s === 'Visually Assessed as Asbestos';
  };
  const isNonAsbestos = (ac) => {
    const s = (ac || '').trim();
    return s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-ACM';
  };
  const getSampleRefDisplay = (item, fallback) => {
    if (isVisuallyAssessed(item.asbestosContent)) return 'Visually assessed';
    const ref = item.sampleReference || fallback;
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    if (sampled && sampled !== item) return `Refer to sample ${ref}`;
    return ref;
  };
  const getLocationContent = (item) => {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const parts = [];
    if (item.levelFloor && String(item.levelFloor).trim()) parts.push(esc(item.levelFloor));
    if (item.roomArea && String(item.roomArea).trim()) parts.push(esc(item.roomArea));
    parts.push(esc(item.locationDescription || 'Unknown Location'));
    return parts.join('<br/>');
  };
  // Assessment register: only show Chrysotile/Amosite/Crocidolite asbestos OR No Asbestos Detected (hide organic, SMF, etc.)
  // Derive asbestos content from analytical data (fibres array) when available - matches fibre ID report logic
  // For referred items (same sampleReference as another item), use the sampled item's asbestos content
  const findSampledItemForRefFlow = (ref) => {
    const r = String(ref || '').trim();
    if (!r) return null;
    return assessmentItems.find((i) => (i.sampleReference || '').trim() === r) || null;
  };
  const getAsbestosContentRawFlow = (item) => {
    if (item.asbestosContent && String(item.asbestosContent).trim()) return item.asbestosContent;
    const ad = item.analysisData;
    if (!ad) {
      const sampled = findSampledItemForRefFlow(item.sampleReference);
      if (sampled && sampled !== item) return getAsbestosContentRawFlow(sampled);
      return null;
    }
    if (ad.fibres && Array.isArray(ad.fibres)) {
      const asbestosFromFibres = ad.fibres
        .filter((f) => {
          if (!f || !f.result) return false;
          const r = String(f.result).trim();
          if (!r || /^non[- ]?asbestos$/i.test(r)) return false;
          return /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(r) || /^umf$/i.test(r) || /^unidentified\s+mineral\s+fibre$/i.test(r);
        })
        .map((f) => {
          const r = String(f.result).trim();
          if (/^umf$/i.test(r)) return 'Unidentified Mineral Fibre (UMF)';
          return r;
        });
      if (asbestosFromFibres.length > 0) return [...new Set(asbestosFromFibres)].join(', ');
    }
    const hasTrace = ad.traceAsbestos === 'yes' && ad.traceCount && ad.traceAsbestosContent;
    if (hasTrace || (ad.finalResult && (/^no asbestos detected$/i.test(ad.finalResult) || ad.finalResult.includes('Trace')))) {
      return ad.finalResult;
    }
    if (ad.finalResult) return ad.finalResult;
    return null;
  };
  const isAsbestosTypeFlow = (p) => /^(chrysotile|amosite|crocidolite)\s+asbestos$/i.test(String(p).trim()) || /^umf$/i.test(String(p).trim()) || /^unidentified\s+mineral\s+fibre(\s*\(umf\))?$/i.test(String(p).trim());
  const getSampleRegisterAsbestosDisplayFlow = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return 'No Asbestos Detected';
    if (s === 'Visually Assessed as Asbestos') return 'Visually Assessed as Asbestos';
    if (s === 'Visually Assessed as Non-Asbestos' || s === 'Visually Assessed as Non-asbestos' || s === 'Visually Assessed as Non-ACM') return 'Visually Assessed as Non-Asbestos';
    if (/^no asbestos detected$/i.test(s)) return 'No Asbestos Detected';
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
    const asbestosTypes = parts.filter(isAsbestosTypeFlow);
    const normaliseFlow = (t) => {
      const lower = t.toLowerCase();
      if (lower.includes('chrysotile')) return 'Chrysotile Asbestos';
      if (lower.includes('amosite')) return 'Amosite Asbestos';
      if (lower.includes('crocidolite')) return 'Crocidolite Asbestos';
      if (lower === 'umf' || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'))) return 'Unidentified Mineral Fibre (UMF)';
      return t;
    };
    const display = asbestosTypes.map(normaliseFlow).filter(Boolean);
    if (display.length > 0) return [...new Set(display)].join(', ');
    if (/trace.*detected/i.test(s)) return s;
    if (/unidentified\s+mineral\s+fibre|^umf(\s|$)/i.test(s)) return /trace/i.test(s) ? s : (/detected/i.test(s) ? 'Unidentified Mineral Fibre (UMF) detected' : 'Unidentified Mineral Fibre (UMF)');
    return 'No Asbestos Detected';
  };
  const getAsbestosContentHtmlFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || item.asbestosContent || 'Not tested';
    const displayText = getSampleRegisterAsbestosDisplayFlow(raw);
    const isNonAsbestosDisplayFlow = displayText === 'No Asbestos Detected' || displayText === 'Visually Assessed as Non-Asbestos';
    const cls = isNonAsbestosDisplayFlow ? 'asbestos-content-non-asbestos' : 'asbestos-content-asbestos';
    const safe = displayText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="${cls}">${safe}</span>`;
  };
  const hasNoAsbestosContentFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
    const display = getSampleRegisterAsbestosDisplayFlow(raw);
    return display === 'No Asbestos Detected' || display === 'Visually Assessed as Non-Asbestos';
  };
  const getAsbestosTypeDisplay = (item) => {
    if (hasNoAsbestosContentFlow(item)) return '-';
    const at = (item.asbestosType || '').toLowerCase();
    if (at === 'friable') return 'Friable';
    if (at === 'non-friable') return 'Non-friable';
    return item.asbestosType || '-';
  };
  const getConditionDisplay = (item) => hasNoAsbestosContentFlow(item) ? '-' : (item.condition || 'Unknown');
  const getRiskDisplay = (item) => hasNoAsbestosContentFlow(item) ? '-' : (item.risk || 'Unknown');
  const getItemNumberFlow = (items, idx) => {
    const item = items[idx];
    if (!item) return '-';
    if (hasNoAsbestosContentFlow(item)) return '-';
    const count = items.slice(0, idx + 1).filter((i) => !hasNoAsbestosContentFlow(i)).length;
    return String(count);
  };
  // Multiple images per item: one table per photo with identical item info
  const getIncludedPhotoSourcesFlow = (item) => {
    const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false).map(p => (p.data || '').trim()).filter(Boolean);
    if (fromArray.length > 0) return fromArray;
    const legacy = (item.photograph || '').trim();
    if (legacy) return [legacy];
    return [null];
  };
  const getSamplePhotoCellHtmlFromSrcFlow = (photoSrc) => {
    let src = photoSrc || '';
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://') && src.startsWith('/')) {
      src = frontendUrl + src;
    }
    if (src) {
      const safe = String(src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div class="sample-photo-cell-inner"><img class="sample-photo" src="${safe}" alt="" /></div>`;
    }
    return '<div class="sample-photo-cell-inner"><div class="sample-no-photo">No photograph available</div></div>';
  };

  // Load sample table partial (snippet)
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const asbestosSampleItemTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosSampleItem.html'), 'utf8');
  const asbestosSampleItemTemplateWithUrl = asbestosSampleItemTemplate.replace(/\[FRONTEND_URL\]/g, frontendUrl);

  const flowTableBlocks = [];
  assessmentItems.forEach((item, idx) => {
    getIncludedPhotoSourcesFlow(item).forEach(photoSrc => flowTableBlocks.push({ item, idx, photoSrc }));
  });
  const sampleTablesHtml = flowTableBlocks.map((block, blockIndex) => {
    const { item, idx, photoSrc } = block;
    const n = idx + 1;
    const sampleTable = asbestosSampleItemTemplateWithUrl
      .replace(/\[PHOTO_CELL\]/g, getSamplePhotoCellHtmlFromSrcFlow(photoSrc))
      .replace(/\[ITEM_NUMBER\]/g, getItemNumberFlow(assessmentItems, idx))
      .replace(/\[SAMPLE_REFERENCE\]/g, getSampleRefDisplay(item, `Sample ${n}`))
      .replace(/\[LOCATION_DESCRIPTION\]/g, getLocationContent(item))
      .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
      .replace(/\[ASBESTOS_CONTENT\]/g, getAsbestosContentHtmlFlow(item))
      .replace(/\[ASBESTOS_TYPE\]/g, getAsbestosTypeDisplay(item))
      .replace(/\[CONDITION\]/g, getConditionDisplay(item))
      .replace(/\[RISK\]/g, getRiskDisplay(item))
      .replace(/\[COMMENTS\]/g, getCommentsValue(item));

    const continuationHeader = blockIndex >= 2 && blockIndex % 2 === 0
      ? '<div class="page-break"></div><div class="section-header">TABLE 1: ASSESSMENT REGISTER cont.</div>'
      : '';
    return `${continuationHeader}<div class="sample-block">${sampleTable}</div>`;
  }).join('');

  // Discussion & Conclusions: asbestos items, then non-asbestos items (build early so flowTemplateData can be used in replacePlaceholders)
  // Use same effective asbestos display logic as sample tables (includes fibres array, referred items)
  const getEffectiveAsbestosDisplayForDiscussionFlow = (item) => {
    const sampled = findSampledItemForRefFlow(item.sampleReference);
    const sourceItem = (sampled && sampled !== item) ? sampled : item;
    const raw = getAsbestosContentRawFlow(item) || sourceItem.analysisData?.finalResult || sourceItem.asbestosContent || '';
    return getSampleRegisterAsbestosDisplayFlow(raw);
  };
  const getDiscussionDisplayFlow = (item) => getEffectiveAsbestosDisplayForDiscussionFlow(item);
  const isAsbestosForDiscussionFlow = (display) => display !== 'No Asbestos Detected' && display !== 'Visually Assessed as Non-Asbestos';
  const identifiedAsbestosItems = assessmentItems.filter(item => isAsbestosForDiscussionFlow(getDiscussionDisplayFlow(item)));
  const identifiedNonAsbestosItems = assessmentItems.filter(item => !isAsbestosForDiscussionFlow(getDiscussionDisplayFlow(item)));

  const discussionDisplayContentLabelFlow = (item) => {
    const display = getEffectiveAsbestosDisplayForDiscussionFlow(item);
    if (display === 'No Asbestos Detected') return 'No asbestos detected';
    return display;
  };

  const isUMFOnlyFlow = (item) => {
    const display = getEffectiveAsbestosDisplayForDiscussionFlow(item);
    if (!display || display === 'No Asbestos Detected') return false;
    const lower = String(display).toLowerCase();
    const hasUMF = lower.includes('umf') || (lower.includes('unidentified') && lower.includes('mineral') && lower.includes('fibre'));
    const hasConfirmedAsbestos = lower.includes('chrysotile') || lower.includes('amosite') || lower.includes('crocidolite');
    return hasUMF && !hasConfirmedAsbestos;
  };

  const formatDiscussionListItemFlow = (item) => {
    const roomArea = escapeHtml(item.roomArea || 'Not specified');
    const loc = escapeHtml(item.locationDescription || 'Unknown Location');
    const visuallyAssessed = isVisuallyAssessed(item.asbestosContent);
    const base = `${roomArea} - ${loc}`;
    const suffix = isUMFOnlyFlow(item) ? ' *' : '';
    return (visuallyAssessed ? `${base} (Visually assessed)` : base) + suffix;
  };
  const hasUMFOnlyItemsFlow = identifiedAsbestosItems.some(isUMFOnlyFlow);
  const umfFootnoteFlow = hasUMFOnlyItemsFlow
    ? '<p style="margin: 8px 0 0 0; font-style: italic; font-size: 0.8rem;"><em>* Item was found to contain Unidentified Mineral Fibre (UMF). Material should be considered to be asbestos unless further analysis can confirm otherwise.</em></p>'
    : '';
  const asbestosItemsSectionFlow = identifiedAsbestosItems.length > 0
    ? `<ul class="bullet-list" style="margin: 0 0 12px 0;">${identifiedAsbestosItems.map(item => `<li>${formatDiscussionListItemFlow(item)}</li>`).join('')}</ul>${umfFootnoteFlow}`
    : '<p style="margin: 0 0 12px 0;">No asbestos items were identified during the assessment.</p>';

  const nonAsbestosItemsSectionFlow = identifiedNonAsbestosItems.length > 0
    ? `<ul class="bullet-list" style="margin: 0 0 12px 0;">${identifiedNonAsbestosItems.map(item => `<li>${formatDiscussionListItemFlow(item)}</li>`).join('')}</ul>`
    : '<p style="margin: 0 0 12px 0;">No non-asbestos items were identified during the assessment.</p>';

  // Data for replacePlaceholders (includes identified asbestos list so {IDENTIFIED_ASBESTOS_ITEMS} resolves correctly)
  const flowTemplateData = { ...assessmentData, identifiedAsbestosItems: asbestosItemsSectionFlow, jurisdiction: assessmentJurisdiction, selectedLegislation: templateContent?.selectedLegislation || [] };

  const introductionHtml = templateContent?.standardSections?.introductionContent
    ? await replacePlaceholders(templateContent.standardSections.introductionContent, flowTemplateData)
    : 'Introduction content not found';

  // Background section (residential only): before Introduction
  const backgroundContentRawFlow = templateContent?.standardSections?.backgroundContent;
  const backgroundHtml = (isResidential && backgroundContentRawFlow)
    ? String(await replacePlaceholders(backgroundContentRawFlow, flowTemplateData) || '').replace(/\n/g, '<br />')
    : '';

  // Survey findings: use No Asbestos content when no asbestos items; otherwise use main survey findings content
  const hasAsbestosItemsFlow = assessmentItems.some((item) => !hasNoAsbestosContentFlow(item));
  const surveyFindingsSourceFlow = hasAsbestosItemsFlow
    ? (templateContent?.standardSections?.surveyFindingsContent || 'Survey findings content not found')
    : (templateContent?.standardSections?.surveyFindingsContentNoSamples || "No asbestos-containing materials were identified during this assessment.");
  let surveyFindingsHtml = surveyFindingsSourceFlow !== 'Survey findings content not found'
    ? await replacePlaceholders(surveyFindingsSourceFlow, flowTemplateData)
    : surveyFindingsSourceFlow;
  const hasSitePlanFlow = !!(assessmentData.sitePlan && assessmentData.sitePlanFile);
  const hasFibreIdReportFlow = !!assessmentData.fibreAnalysisReport;
  const sitePlanAppendixFlow = hasFibreIdReportFlow ? 'Appendix B' : 'Appendix A';
  if (hasSitePlanFlow) {
    surveyFindingsHtml += `<p style="margin-top: 12px;">A site plan for this assessment is presented in ${escapeHtml(sitePlanAppendixFlow)} of this report.</p>`;
  }

  const asbestosCountFlow = identifiedAsbestosItems.length;
  const hasSampledItemsRequiringAnalysisFlow = assessmentItems.some((i) => (i.sampleReference || '').trim() && !isVisuallyAssessed(i.asbestosContent));
  const firstSampledPerRefFlow = hasSampledItemsRequiringAnalysisFlow
    ? assessmentItems.filter((item, index) => {
        if (!(item.sampleReference || '').trim() || isVisuallyAssessed(item.asbestosContent)) return false;
        const ref = item.sampleReference.trim();
        return index === assessmentItems.findIndex((i) => (i.sampleReference || '').trim() === ref);
      })
    : [];
  const analysisCompleteFlow = assessmentData.status === 'sample-analysis-complete' ||
    !hasSampledItemsRequiringAnalysisFlow ||
    firstSampledPerRefFlow.every((i) => i.analysisData?.isAnalysed === true);
  const asbestosCountDisplayFlow = asbestosCountFlow > 0 ? formatAsbestosCountForPdf(asbestosCountFlow, analysisCompleteFlow) : String(asbestosCountFlow);
  const acmRemovalSentenceFlow = 'ACM should be removed prior to the commencement of works which may damage or disturb the material.';
  let defaultDiscussionTextFlow = asbestosCountFlow === 0
    ? `No asbestos containing materials were identified during the assessment conducted at ${assessmentSiteAddress}.`
    : `${asbestosCountDisplayFlow} asbestos items were identified during the assessment of ${assessmentSiteAddress}.`;
  const residentialCeilingSubfloorText = 'The assessment of the ceiling void was limited to a visual inspection from the access hatch. A combination of insulation batts and loose-fill insulation was identified within the ceiling void, these materials were visually assessed as synthetic mineral fibres (SMF). No suspect ACM was identified during the assessment of the ceiling void however, it is common for ACM to be present within ceiling voids in the forms of debris and/or packers. It is recommended that persons accessing the ceiling void wear a minimum P2 respirator and coveralls.\n\nNo suspect ACM was identified during the assessment of the subfloor, it is common for ACM to be present within subfloors in the form of debris, packers, and/or formwork. It is recommended that persons accessing the crawl space wear a minimum P2 respirator and coveralls.';
  if (isResidential) {
    defaultDiscussionTextFlow = defaultDiscussionTextFlow + '\n\n' + residentialCeilingSubfloorText;
  }
  if (asbestosCountFlow > 0) {
    defaultDiscussionTextFlow = defaultDiscussionTextFlow + '\n\n' + acmRemovalSentenceFlow;
  }
  // Use saved discussion/conclusions as-is when present (modal already includes ACM sentence and residential text in its default)
  let discussionConclusionsRaw = (assessmentData.discussionConclusions || '').trim() || defaultDiscussionTextFlow;
  const analysisIncompleteReplacementFlow = formatAsbestosCountForPdf(asbestosCountFlow, analysisCompleteFlow);
  discussionConclusionsRaw = discussionConclusionsRaw
    .replace(/\{ANALYSIS INCOMPLETE\}/g, analysisIncompleteReplacementFlow)
    .replace(/\{ANALYSIS_INCOMPLETE\}/g, analysisIncompleteReplacementFlow);
  const discussionConclusionsHtml = toJustifiedParagraphsHtml(discussionConclusionsRaw);

  const jobSpecificExclusionsRaw = (assessmentData.jobSpecificExclusions || '').trim();
  const inspectionExclusionsHtml = toJustifiedParagraphsHtml(jobSpecificExclusionsRaw);

  // Recommended Control Measures is rendered between Discussion and Conclusions and sign-off (see flow HTML)
  const recommendedControlMeasuresContentFlow = templateContent?.standardSections?.recommendedControlMeasuresContent
    ? await replacePlaceholders(templateContent.standardSections.recommendedControlMeasuresContent, flowTemplateData)
    : '';
  const recommendedControlMeasuresHtml = `<div class="section-header">${escapeHtml(templateContent?.standardSections?.recommendedControlMeasuresTitle || 'RECOMMENDED CONTROL MEASURES')}</div><div class="section-body">${recommendedControlMeasuresContentFlow || ''}</div>`;

  const additionalSections = [
    { title: templateContent?.standardSections?.assessmentMethodologyTitle || 'ASSESSMENT METHODOLOGY', content: templateContent?.standardSections?.assessmentMethodologyContent ? await replacePlaceholders(templateContent.standardSections.assessmentMethodologyContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.riskAssessmentTitle || 'RISK ASSESSMENT', content: templateContent?.standardSections?.riskAssessmentContent ? await replacePlaceholders(templateContent.standardSections.riskAssessmentContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.controlMeasuresTitle || 'DETERMINING SUITABLE CONTROL MEASURES', content: templateContent?.standardSections?.controlMeasuresContent ? await replacePlaceholders(templateContent.standardSections.controlMeasuresContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.remediationRequirementsTitle || 'REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM', content: templateContent?.standardSections?.remediationRequirementsContent ? await replacePlaceholders(templateContent.standardSections.remediationRequirementsContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.legislationTitle || 'LEGISLATION', content: templateContent?.standardSections?.legislationContent ? await replacePlaceholders(templateContent.standardSections.legislationContent, flowTemplateData) : '' },
    { title: templateContent?.standardSections?.assessmentLimitationsTitle || 'ASSESSMENT LIMITATIONS/CAVEATS', content: templateContent?.standardSections?.assessmentLimitationsContent ? await replacePlaceholders(templateContent.standardSections.assessmentLimitationsContent, flowTemplateData) : '' }
  ];

  const bodySectionsHtml = additionalSections.map((s, i) => {
    const sectionHtml = `<div class="section-header">${escapeHtml(s.title)}</div><div class="section-body">${s.content || ''}</div>`;
    // Page break after DETERMINING SUITABLE CONTROL MEASURES (3rd section, index 2)
    return i === 2 ? `${sectionHtml}<div class="page-break"></div>` : sectionHtml;
  }).join('');

  const discussionSignOffContent = templateContent?.standardSections?.signOffContent
    ? await replacePlaceholders(templateContent.standardSections.signOffContent, flowTemplateData)
    : '';
  const discussionSignatureContent = templateContent?.standardSections?.signaturePlaceholder
    ? await replacePlaceholders(templateContent.standardSections.signaturePlaceholder, flowTemplateData)
    : '';

  // Appendix cover pages are generated as separate PDFs (no page number in footer) and merged after flow + fibre analysis

  // Glossary: last page of flow (before first attachment cover), same header/footer and page number
  let glossaryTableRows = '';
  try {
    const glossaryItems = await CustomDataFieldGroup.getFieldsByType('glossary');
    const sorted = (glossaryItems || []).slice().sort((a, b) => {
      const nameA = (a.name || a.text || '').trim().toLowerCase();
      const nameB = (b.name || b.text || '').trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });
    glossaryTableRows = sorted.map((item) => {
      const term = (item.name || item.text || '').trim();
      const definition = (item.text || '').trim();
      const termEscaped = escapeHtml(term);
      const definitionEscaped = (definition || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');
      return `<tr><td class="glossary-term">${termEscaped}</td><td class="glossary-definition">${definitionEscaped}</td></tr>`;
    }).join('');
  } catch (err) {
    console.warn('[generateAssessmentFlowHTMLV3] Could not load glossary:', err.message);
  }
  const glossarySectionHtml = `
        <div class="section-header">Glossary Of Terms Associated with Asbestos</div>
        <table class="glossary-table">
          <thead>
            <tr>
              <th class="glossary-term">Term</th>
              <th class="glossary-definition">Definition</th>
            </tr>
          </thead>
          <tbody>
            ${glossaryTableRows || '<tr><td colspan="2" class="glossary-definition">No glossary terms have been defined.</td></tr>'}
          </tbody>
        </table>`;

  // Flow HTML with running header/footer
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Asbestos Assessment Report (Flow)</title>
        <style>
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Regular.ttf") format("truetype"); font-weight: normal; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Bold.ttf") format("truetype"); font-weight: bold; font-style: normal; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-Italic.ttf") format("truetype"); font-weight: normal; font-style: italic; }
          @font-face { font-family: "Gothic"; src: url("${frontendUrl}/fonts/static/Gothic-BoldItalic.ttf") format("truetype"); font-weight: bold; font-style: italic; }

          * { hyphens: none !important; -webkit-hyphens: none !important; -ms-hyphens: none !important; word-break: keep-all !important; overflow-wrap: normal !important; }
          body { font-family: "Gothic", Arial, sans-serif; color: #222; margin: 0; }

          /* Running header/footer for automatic pagination */
          @page {
            size: A4;
            /* Increase top margin to ensure body content never overlaps running header */
            margin: 35mm 15mm 18mm 15mm;
            @top-left { content: element(pageHeader); }
            @bottom-left { content: element(pageFooter); }
          }

          #pageHeader { position: running(pageHeader); }
          #pageFooter { position: running(pageFooter); }

          /* Match VersionControl look, but fit to the @page content box (full width inside margins) */
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0; margin: 0; }
          .logo { width: 243px; height: auto; display: block; margin: 0; }
          .company-details { text-align: right; font-size: 0.75rem; line-height: 1.5; margin-top: 8px; margin: 0; }
          .website { color: #16b12b; font-weight: 500; }
          .green-line { width: 100%; height: 1.5px; background: #16b12b; margin: 8px 0 0 0; border-radius: 0; }

          /* Match VersionControl footer formatting */
          .footer { width: 100%; margin: 0; text-align: justify; font-size: 0.75rem; color: #222; padding-bottom: 16px; }
          .footer-border-line { width: 100%; height: 1.5px; background: #16b12b; margin-bottom: 6px; border-radius: 0; }
          .footer-content { width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
          .footer-text { flex: 1; }
          .page-number { font-size: 0.75rem; color: #222; font-weight: 500; margin-left: 20px; }
          .page-number::after { content: counter(page); }

          /* Section spacing – match AsbestosAdditionalSections / AsbestosItem1 */
          .section-header { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin: 10px 0 10px 0; letter-spacing: 0.01em; }
          .page-break + .section-header { margin-top: 0; } /* avoid starting too low at top of a new page */
          .section-body { font-size: 0.8rem; line-height: 1.5; text-align: justify; margin-bottom: 18px; }
          .section-body.discussion-conclusions-content,
          .section-body.discussion-conclusions-content p { word-break: normal !important; overflow-wrap: break-word !important; }
          .section-body.discussion-conclusions-content { text-align: justify !important; width: 100%; }
          .section-body br { line-height: 1.5; display: block; margin-bottom: 0.25em; }
          .section-body .paragraph { margin-bottom: 8px; }
          .section-body .bullet-list { margin: 0 0 8px 0; padding: 0 0 0 24px; list-style: none; font-size: 0.8rem; color: #222; }
          .section-body .bullet-list li { margin-bottom: 8px; position: relative; padding-left: 20px; line-height: 1.5; text-align: left; }
          .section-body .bullet-list li::before { content: "•"; position: absolute; left: 0; top: 0.25em; font-size: 1em; color: #222; line-height: 1; }
          ul { margin: 0 0 8px 0; padding: 0 0 0 24px; }
          li { margin-bottom: 8px; }

          .sample-register-header { font-size: 0.8rem; font-weight: 700; margin: 14px 0 10px 0; }
          .sample-block { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; }

          /* Reuse the sample table styles from Item1 (lighter weight) */
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1.5px solid #888; padding: 6px 8px; font-size: 0.64rem; vertical-align: top; }
          th { background: #f5f5f5; font-weight: 700; text-align: left; }
          /* Ensure assessment register "field headers" are bold */
          .sample-label { font-weight: 700; background: #f5f5f5; }
          .sample-asbestos-content-cell { font-weight: 700; }
          /* Recommendation Actions/Comments row fixed (3-line minimum height) */
          .comments-cell-inner { min-height: 2.7rem; display: block; }
          .sample-risk-cell { line-height: 1; height: 1.2em; padding: 4px 4px; vertical-align: middle; }
          .sample-location-content { height: 60px; vertical-align: top; padding: 8px; background: #fafafa; border: 1.5px solid #888; font-size: 0.64rem; line-height: 1.4; }
          .sample-photo-cell { width: 71% !important; height: 340px !important; overflow: hidden !important; box-sizing: border-box !important; text-align: center; vertical-align: middle; background: #fff; padding: 0 !important; margin: 0 !important; }
          .sample-photo-cell-inner { display: block; width: 100%; height: 340px; overflow: hidden; box-sizing: border-box; padding: 0; margin: 0; }
          .sample-photo { display: block !important; width: 100% !important; height: 100% !important; object-fit: contain !important; object-position: center !important; padding: 0 !important; }
          .sample-no-photo { display: flex; align-items: center; justify-content: center; min-height: 340px; height: 100%; color: #666; font-style: italic; font-size: 0.64rem; }
          .asbestos-content-asbestos { color: #c62828; font-weight: 700; }
          .asbestos-content-non-asbestos { color: #2e7d32; font-weight: 700; }

          /* Glossary page: 2-column table (same header/footer as other flow pages) */
          .glossary-table { width: 100%; border-collapse: collapse; font-size: 0.9em; color: #222; margin: 10px 0 0 0; }
          .glossary-table th, .glossary-table td { border: 1.5px solid #888; padding: 8px 12px; text-align: left; vertical-align: top; line-height: 1.5; font-size: 0.8em; }
          .glossary-table th { background: #f5f5f5; font-weight: 700; }
          .glossary-table .glossary-term { width: 28%; font-weight: 600; }
          .glossary-table .glossary-definition { width: 72%; }

          .page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        <div id="pageHeader">
          <div class="header">
            <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="green-line"></div>
        </div>

        <div id="pageFooter">
          <div class="footer">
            <div class="footer-border-line"></div>
            <div class="footer-content">
              <div class="footer-text">${escapeHtml(assessmentFooterText)}</div>
              <div class="page-number"></div>
            </div>
          </div>
        </div>

        ${backgroundHtml ? `<div class="section-header">${escapeHtml(templateContent?.standardSections?.backgroundTitle || 'BACKGROUND')}</div><div class="section-body">${backgroundHtml}</div>` : ''}
        <div class="section-header">${escapeHtml(templateContent?.standardSections?.introductionTitle || 'INTRODUCTION')}</div>
        <div class="section-body">${introductionHtml}</div>

        <div class="section-header">${escapeHtml(templateContent?.standardSections?.surveyFindingsTitle || 'SUMMARY OF IDENTIFIED ACM')}</div>
        <div class="section-body">${surveyFindingsHtml}</div>

        <div class="page-break"></div>
        <div class="section-header">Table 1: Assessment Register</div>
        ${sampleTablesHtml || '<div class="section-body">No items</div>'}

        <div class="page-break"></div>
        <div class="section-header">${escapeHtml(templateContent?.standardSections?.discussionTitle || 'DISCUSSION AND CONCLUSIONS')}</div>
        <div class="section-body">
          ${isResidential
            ? `${discussionConclusionsHtml ? `<div class="section-body discussion-conclusions-content" style="text-align: justify !important; width: 100%;">${discussionConclusionsHtml}</div>` : ''}${inspectionExclusionsHtml ? `<div class="section-body discussion-conclusions-content" style="margin-top: 12px; text-align: justify !important; width: 100%;">${inspectionExclusionsHtml}</div>` : ''}`
            : `<p style="margin: 0; padding-bottom: 8px;">The following is a summary of asbestos and non-asbestos materials identified during this assessment:</p>
          <p style="margin: 0; padding-bottom: 4px; text-decoration: underline; font-weight: 600; font-size: 0.8rem;">Asbestos Items</p>
          ${asbestosItemsSectionFlow}
          <p style="margin: 0; padding-bottom: 4px; text-decoration: underline; font-weight: 600; font-size: 0.8rem;">Non-asbestos Items</p>
          ${nonAsbestosItemsSectionFlow}
          ${discussionConclusionsHtml ? `<div class="section-body discussion-conclusions-content" style="margin-top: 12px; text-align: justify !important; width: 100%;">${discussionConclusionsHtml}</div>` : ''}
          ${inspectionExclusionsHtml ? `<div class="section-body discussion-conclusions-content" style="margin-top: 12px; text-align: justify !important; width: 100%;">${inspectionExclusionsHtml}</div>` : ''}`}
        </div>

        ${recommendedControlMeasuresHtml}

        <div class="section-body discussion-signoff">
          ${discussionSignOffContent || ''}
          ${discussionSignatureContent || ''}
        </div>

        <div class="page-break"></div>
        ${bodySectionsHtml}

        <!-- Glossary of Terms (last page before first attachment cover; same header/footer and page number) -->
        <div class="page-break"></div>
        ${glossarySectionHtml}
      </body>
    </html>
  `;

  return html;
};

const mergePdfBuffers = async (buffers) => {
  const out = await PDFDocument.create();
  for (const b of buffers) {
    const src = await PDFDocument.load(b);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
};

/**
 * V3: Generate single-page Appendix A or B cover HTML (footer with no page number).
 * Uses existing DocRaptor templates so Appendix A and all pages after have no page number.
 * For site plan (type 'B'), appendixLetterOverride can be 'A' or 'B': use 'A' when there is no
 * certificate of analysis (fibre ID report), so site plan becomes Appendix A.
 */
const generateAppendixCoverHTMLV3 = (type, assessmentData, appendixLetterOverride) => {
  const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosAssessment');
  const templatePath = type === 'A' ? path.join(templateDir, 'AppendixACover.html') : path.join(templateDir, 'AppendixBCover.html');
  let html = fs.readFileSync(templatePath, 'utf8');
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const logoPath = path.join(__dirname, '../assets/logo.png');
  const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
  const watermarkPath = path.join(__dirname, '../assets/logo_small hi-res.png');
  const watermarkBase64 = fs.existsSync(watermarkPath) ? fs.readFileSync(watermarkPath).toString('base64') : '';
  const siteAddress = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site';
  html = html.replace(/\[FRONTEND_URL\]/g, frontendUrl)
    .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
    .replace(/\[WATERMARK_PATH\]/g, `data:image/png;base64,${watermarkBase64}`)
    .replace(/\[SITE_ADDRESS\]/g, siteAddress);
  if (type === 'B' && appendixLetterOverride) {
    html = html.replace(/\[APPENDIX_LETTER\]/g, appendixLetterOverride);
  } else if (type === 'B') {
    html = html.replace(/\[APPENDIX_LETTER\]/g, 'B');
  }
  return html;
};

const generateAssessmentPhotographsContent = (items) => {
  if (!items || items.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Flatten: each item can have multiple photos (photographs array with includeInReport, or legacy photograph)
  const photoEntries = [];
  items.forEach((item) => {
    const fromArray = (item.photographs || []).filter(p => p.includeInReport !== false).map(p => (p.data || '').trim()).filter(Boolean);
    if (fromArray.length > 0) {
      fromArray.forEach(src => photoEntries.push({ src, item }));
    } else if (item.photograph && item.photograph.trim() !== '') {
      photoEntries.push({ src: item.photograph.trim(), item });
    }
  });

  if (photoEntries.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Split photos into pages of 2 photos each
  const pages = [];
  for (let i = 0; i < photoEntries.length; i += 2) {
    const pageItems = photoEntries.slice(i, i + 2);
    const pageContent = pageItems.map((entry, index) => {
      const photoNumber = i + index + 1;
      const safe = String(entry.src).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const loc = (entry.item.locationDescription || 'Unknown Location').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const mat = (entry.item.materialType || entry.item.materialDescription || 'Unknown Material').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="photo-container">
          <div class="photo">
            <img src="${safe}" alt="Assessment Photo ${photoNumber}" />
          </div>
          <div class="photo-details">
            <div class="photo-number">Photo ${photoNumber}</div>
            <div class="photo-location">${loc}</div>
            <div class="photo-materials">${mat}</div>
          </div>
        </div>
      `;
    }).join('');

    // Create a complete page with header and footer
    pages.push(`
      <div class="page photos-page">
        <div class="header">
          <img class="logo" src="[LOGO_PATH]" alt="Company Logo" />
          <div class="company-details">
            Lancaster & Dickenson Consulting Pty Ltd<br />
            4/6 Dacre Street<br />
            Mitchell ACT 2911<br />
            <span class="website">www.landd.com.au</span>
          </div>
        </div>
        <div class="green-line"></div>
        <div class="content" style="justify-content: flex-start; align-items: flex-start">
          <div class="title" style="margin-top: 8px">
            PHOTOGRAPHS
          </div>
          ${pageContent}
        </div>
        <div class="footer">
          <div class="footer-content">
            <div class="footer-line"></div>
            Asbestos Assessment Report: [SITE_ADDRESS]
          </div>
        </div>
      </div>
      ${i + 2 < photoEntries.length ? '<div class="page-break"></div>' : ''}
    `);
  }

  return pages.join('');
};



/**
 * Generate PDF from document definition
 */
router.post('/generate', auth, async (req, res) => {
  try {
    const doc = req.body;
    if (!doc) {
      return res.status(400).json({ error: 'Document definition is required' });
    }

    // Generate HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Generated PDF</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          .header {
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
          }
          .subheader {
            font-size: 16px;
            font-weight: bold;
            margin: 10px 0 5px 0;
          }
          .columns {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          .column {
            flex: 1;
          }
          .bold {
            font-weight: bold;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .table-header {
            background-color: #f5f5f5;
            font-weight: bold;
            text-align: center;
            padding: 8px;
            border: 1px solid #ddd;
          }
          .table-cell {
            padding: 8px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        ${doc.content.map(item => {
          if (item.text === '\\n') return '<br/>';
          if (item.style === 'header') return `<div class="header">${item.text}</div>`;
          if (item.style === 'subheader') return `<div class="subheader">${item.text}</div>`;
          if (item.table) {
            return `
              <table class="table">
                <thead>
                  <tr>
                    ${item.table.body[0].map(cell => `
                      <th class="table-header">
                        ${typeof cell === 'string' ? cell : cell.text}
                      </th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${item.table.body.slice(1).map(row => `
                    <tr>
                      ${row.map(cell => `
                        <td class="table-cell">
                          ${typeof cell === 'string' ? cell : cell.text}
                        </td>
                      `).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;
          }
          if (item.columns) {
            return `
              <div class="columns">
                ${item.columns.map(col => {
                  if (col.table) {
                    return `
                      <div class="column" style="width: ${col.width === '*' ? '100%' : 'auto'}">
                        <table class="table">
                          <tbody>
                            ${col.table.body.map(row => `
                              <tr>
                                ${row.map(cell => `
                                  <td class="table-cell" style="text-align: ${cell.alignment || 'left'}">
                                    ${typeof cell === 'string' ? cell : (cell.bold ? `<strong>${cell.text}</strong>` : cell.text)}
                                  </td>
                                `).join('')}
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                  }
                  return `
                    <div class="column" style="width: ${col.width === '*' ? '100%' : 'auto'}">
                      ${Array.isArray(col.text) ? col.text.map(t => 
                        typeof t === 'string' ? t : 
                        t.bold ? `<span class="bold">${t.text}</span>` : t.text
                      ).join('') : col.text}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }
          if (Array.isArray(item.text)) {
            return item.text.map(t => 
              typeof t === 'string' ? t : 
              t.bold ? `<span class="bold">${t.text}</span>` : t.text
            ).join('');
          }
          return item.text;
        }).join('')}
      </body>
      </html>
    `;

    // Generate PDF using DocRaptor
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent, {
      page_size: 'A4',
      prince_options: {
        media: 'print',
        html_mode: 'quirks'
      }
    });

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

module.exports = router; 