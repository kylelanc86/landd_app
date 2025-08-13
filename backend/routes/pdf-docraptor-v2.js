const express = require('express');
const router = express.Router();
const DocRaptorService = require('../services/docraptorService');
const fs = require('fs');
const path = require('path');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');
const { PDFDocument } = require('pdf-lib');
const auth = require('../middleware/auth');

// Initialize DocRaptor service
const docRaptorService = new DocRaptorService();

// Performance monitoring
const backendPerformanceMonitor = {
  startStage: (stageName, pdfId = 'default') => {
    console.log(`[${pdfId}] Starting stage: ${stageName}`);
    return Date.now();
  },
  endStage: (stageName, pdfId = 'default') => {
    console.log(`[${pdfId}] Completed stage: ${stageName}`);
  }
};

/**
 * Generate complete HTML content for clearance report using DocRaptor-optimized templates
 */
const generateClearanceHTMLV2 = async (clearanceData) => {
  try {
    
    // Load DocRaptor-optimized templates
    const templateDir = path.join(__dirname, '../templates/DocRaptor/AsbestosClearance');
    const coverTemplate = fs.readFileSync(path.join(templateDir, 'CoverPage.html'), 'utf8');
    const versionControlTemplate = fs.readFileSync(path.join(templateDir, 'VersionControl.html'), 'utf8');
    const inspectionDetailsTemplate = fs.readFileSync(path.join(templateDir, 'InspectionDetails.html'), 'utf8');
    const backgroundInformationTemplate = fs.readFileSync(path.join(templateDir, 'BackgroundInformation.html'), 'utf8');
    const appendixACoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    // photographsTemplate no longer used - photos generated independently
    const photoItemTemplate = fs.readFileSync(path.join(templateDir, 'PhotoItem.html'), 'utf8');
    const photoPageTemplate = fs.readFileSync(path.join(templateDir, 'PhotoPage.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    const appendixCCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixCCover.html'), 'utf8');
    
    // Load logo and background images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    console.log('\n\n>>>>> BACKGROUND_CHECK <<<<<');
    console.log('Background path:', backgroundPath);
    console.log('Background exists:', fs.existsSync(backgroundPath));
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';
    console.log('Background loaded:', backgroundBase64.length > 0);

    // Fetch template content from database
    const templateType = clearanceData.clearanceType === 'Friable' ? 'asbestosClearanceFriable' : 'asbestosClearanceNonFriable';
    const templateContent = await getTemplateByType(templateType);
    


    // Debug logging for cover page data
    console.log('\n\n>>>>> COVER_PAGE_CHECK <<<<<\n', {
      type: clearanceData.clearanceType,
      site: clearanceData.projectId?.name || clearanceData.siteName,
      ref: clearanceData.projectId?.projectID,
      date: clearanceData.clearanceDate,
      hasLogo: !!logoBase64,
      hasBackground: !!backgroundBase64
    });

    // Populate cover template with data
    const populatedCover = coverTemplate
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
      .replace(/\[JOB_REFERENCE\]/g, clearanceData.projectId?.projectID || 'Unknown')
      .replace(/\[CLEARANCE_DATE\]/g, clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

    // Populate version control template with data
    const populatedVersionControl = versionControlTemplate
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')
      .replace(/\[CLEARANCE_DATE\]/g, clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[LAA_NAME\]/g, clearanceData.LAA || 'Unknown LAA')
      .replace(/\[FILENAME\]/g, `${clearanceData.projectId?.projectID || 'Unknown'}_${clearanceData.clearanceType || 'Non-Friable'}_Clearance_${clearanceData.projectId?.name || 'Unknown'}.pdf`)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

    // Generate clearance items table
    const generateClearanceItemsTable = () => {
      const items = clearanceData.items || [];
      console.log('Clearance items for table:', items);
      
      if (items.length === 0) {
        console.log('No clearance items found, showing placeholder');
        return '<tr><td colspan="4" style="text-align: center; font-style: italic;">No clearance items found</td></tr>';
      }
      
      const tableRows = items.map((item, index) => {
        // Format asbestos type properly
        const formattedAsbestosType = item.asbestosType 
          ? item.asbestosType.charAt(0).toUpperCase() + item.asbestosType.slice(1).replace('-', '-')
          : 'Non-friable';
        
        return `<tr>
            <td>${index + 1}</td>
          <td>${item.locationDescription || 'Unknown Location'}</td>
          <td>${item.materialDescription || 'Unknown Material'}</td>
          <td>${formattedAsbestosType}</td>
        </tr>`;
      }).join('');
      
      console.log('Generated table rows:', tableRows);
      return tableRows;
    };

    // Generate photographs content for clearance reports using template approach
    const generateClearancePhotographsContent = () => {
      // Use actual clearance items if provided, otherwise use sample data
      const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
      
      // Filter out items that don't have photographs
      const itemsWithPhotos = clearanceItems.filter(item => 
        item.photograph && item.photograph.trim() !== ''
      );
      
      console.log('Items with photos:', itemsWithPhotos.length);
      
      if (itemsWithPhotos.length === 0) {
        return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
      }
      
      // Generate pages with 2 photos each using template
      const pages = [];
      
      for (let i = 0; i < itemsWithPhotos.length; i += 2) {
        const pagePhotos = itemsWithPhotos.slice(i, i + 2);
        const photoItems = pagePhotos.map((item, pageIndex) => {
          const photoNumber = i + pageIndex + 1;
          return photoItemTemplate
            .replace(/\[PHOTO_URL\]/g, item.photograph)
            .replace(/\[PHOTO_NUMBER\]/g, photoNumber.toString())
            .replace(/\[LOCATION_DESCRIPTION\]/g, item.locationDescription || 'Unknown Location')
            .replace(/\[MATERIAL_DESCRIPTION\]/g, item.materialDescription || 'Unknown Material');
        }).join('');
        
        // Use the photo page template and replace all placeholders
        const page = photoPageTemplate
          .replace(/\[PHOTO_ITEMS\]/g, photoItems)
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site');
        
        pages.push(page);
        
        // Add page break between pages (but not after the last page)
        if (i + 2 < itemsWithPhotos.length) {
          pages.push('<div class="page-break"></div>');
        }
      }
      
      return pages.join('');
    };

    // Prepare template content placeholders first (async operations)
    const inspectionDetailsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionDetailsContent, clearanceData) : 'Inspection details content not found';
    const inspectionExclusionsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.inspectionExclusionsContent, clearanceData) : 'Inspection exclusions content not found';
    const clearanceCertificationContent = templateContent ? await replacePlaceholders(templateContent.standardSections.clearanceCertificationContent, clearanceData) : 'Clearance certification content not found';
    const signOffContent = templateContent ? await replacePlaceholders(templateContent.standardSections.signOffContent, clearanceData) : 'Sign-off content not found';

    // Populate inspection details template with data
    const populatedInspectionDetails = inspectionDetailsTemplate
      .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
      .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
      .replace(/\[CLEARANCE_DATE\]/g, clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[CLIENT_NAME\]/g, clearanceData.projectId?.client?.name || clearanceData.clientName || 'Unknown Client')
      .replace(/\[ASBESTOS_TYPE\]/g, clearanceData.clearanceType || 'Non-friable')
      .replace(/\[ASBESTOS_REMOVALIST\]/g, clearanceData.asbestosRemovalist || 'Unknown Removalist')
      .replace(/\[LAA_NAME\]/g, clearanceData.LAA || clearanceData.laaName || 'Unknown LAA')
      .replace(/\[LAA_LICENSE\]/g, 'AA00031')
      .replace(/\[INSPECTION_TIME\]/g, clearanceData.inspectionTime || 'Unknown Time')
      .replace(/\[INSPECTION_DATE\]/g, clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[SIGNATURE_IMAGE\]/g, '') // Will be handled by replacePlaceholders in template content
      .replace(/\[CLEARANCE_ITEMS_TABLE\]/g, generateClearanceItemsTable())
      // Template content placeholders
      .replace(/\[INSPECTION_DETAILS_TITLE\]/g, templateContent?.standardSections?.inspectionDetailsTitle || 'INSPECTION DETAILS')
      .replace(/\[INSPECTION_DETAILS_CONTENT\]/g, inspectionDetailsContent)
      .replace(/\[INSPECTION_EXCLUSIONS_TITLE\]/g, templateContent?.standardSections?.inspectionExclusionsTitle || 'INSPECTION EXCLUSIONS')
      .replace(/\[INSPECTION_EXCLUSIONS_CONTENT\]/g, inspectionExclusionsContent)
      .replace(/\[CLEARANCE_CERTIFICATION_TITLE\]/g, templateContent?.standardSections?.clearanceCertificationTitle || 'CLEARANCE CERTIFICATION')
      .replace(/\[CLEARANCE_CERTIFICATION_CONTENT\]/g, clearanceCertificationContent)
      .replace(/\[SIGN_OFF_CONTENT\]/g, signOffContent);

    // Prepare background information template content placeholders (async operations)
    const backgroundInformationContent = templateContent ? await replacePlaceholders(templateContent.standardSections.backgroundInformationContent, clearanceData) : 'Background information content not found';
    const legislativeRequirementsContent = templateContent ? await replacePlaceholders(templateContent.standardSections.legislativeRequirementsContent, clearanceData) : 'Legislative requirements content not found';
    
    // Handle limitations based on clearance type (like the old PDF route)
    const clearanceCertificateLimitationsContent = clearanceData.clearanceType === 'Friable'
      ? (templateContent ? await replacePlaceholders(templateContent.standardSections.friableClearanceCertificateLimitationsContent, clearanceData) : 'Friable clearance certificate limitations content not available')
      : (templateContent ? await replacePlaceholders(templateContent.standardSections.nonFriableClearanceCertificateLimitationsContent, clearanceData) : 'Non-friable clearance certificate limitations content not available');

    // Populate background information template with data
    const populatedBackgroundInformation = backgroundInformationTemplate
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      // Template content placeholders
      .replace(/\[BACKGROUND_INFORMATION_TITLE\]/g, templateContent?.standardSections?.backgroundInformationTitle || 'BACKGROUND INFORMATION')
      .replace(/\[BACKGROUND_INFORMATION_CONTENT\]/g, backgroundInformationContent)
      .replace(/\[LEGISLATIVE_REQUIREMENTS_TITLE\]/g, templateContent?.standardSections?.legislativeRequirementsTitle || 'LEGISLATIVE REQUIREMENTS')
      .replace(/\[LEGISLATIVE_REQUIREMENTS_CONTENT\]/g, legislativeRequirementsContent)
      .replace(/\[CLEARANCE_CERTIFICATE_LIMITATIONS_TITLE\]/g, clearanceData.clearanceType === 'Friable' 
        ? (templateContent?.standardSections?.friableClearanceCertificateLimitationsTitle || 'Friable Clearance Certificate Limitations')
        : (templateContent?.standardSections?.nonFriableClearanceCertificateLimitationsTitle || 'Non-Friable Clearance Certificate Limitations'))
      .replace(/\[CLEARANCE_CERTIFICATE_LIMITATIONS_CONTENT\]/g, clearanceCertificateLimitationsContent);

    // Extract just the page content from each template
    const extractPageContent = (html) => {
      const pageMatch = html.match(/<div class="page">([\s\S]*?)<\/div>\s*<\/body>/);
      return pageMatch ? `<div class="page">${pageMatch[1]}</div>` : html;
    };

    // Determine appendix structure based on site plan and air monitoring
    const hasSitePlan = clearanceData.sitePlan && clearanceData.sitePlanFile;
    const hasAirMonitoring = clearanceData.airMonitoring;
    
    console.log('[DEBUG] Appendix structure - hasSitePlan:', hasSitePlan, 'hasAirMonitoring:', hasAirMonitoring);
    
    // Generate dynamic appendix content
    let appendixContent = '';
    
    // Check if we have any photographs
    const clearanceItems = clearanceData.items || clearanceData.clearanceItems || clearanceData.removalItems || clearanceData.asbestosItems || [];
    const hasPhotographs = clearanceItems.some(item => item.photograph && item.photograph.trim() !== '');

    // Include Appendix A only if we have photographs
    if (hasPhotographs) {
      // For Appendix A cover, we need to keep the CSS
      const populatedAppendixACover = appendixACoverTemplate
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

      // Generate photos section completely independently (no template mixing)
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
        appendixBCoverTemplate
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      );
      
      appendixContent += `
          <!-- Appendix B Cover Page (Site Plan) -->
          ${populatedAppendixBCover}
      `;
      
      // Add site plan content page if it's an image
      const isSitePlanImage = clearanceData.sitePlanFile && (
        clearanceData.sitePlanFile.startsWith('/9j/') || 
        clearanceData.sitePlanFile.startsWith('iVBORw0KGgo')
      );
      
      if (isSitePlanImage) {
        const sitePlanContentPage = generateSitePlanContentPage(clearanceData, 'B', logoBase64);
        appendixContent += `
            <!-- Appendix B Site Plan Content Page -->
            ${sitePlanContentPage}
        `;
      }
      
    if (hasAirMonitoring) {
        // Both Site Plan and Air Monitoring exist - add Air Monitoring as Appendix C
        const populatedAppendixCCover = extractPageContent(
          appendixCCoverTemplate
            .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
            .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
            .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
        );
        
        appendixContent += `
            <!-- Appendix C Cover Page (Air Monitoring) -->
            ${populatedAppendixCCover}
        `;
      }
    } else if (hasAirMonitoring) {
      // No Site Plan but Air Monitoring exists - add Air Monitoring as Appendix B
      const populatedAppendixBCover = extractPageContent(
        appendixBCoverTemplate
        .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
        .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
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
            height: 4px;
            background: #16b12b;
            margin: 8px auto 0 auto;
            border-radius: 2px;
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

          .photo-materials {
            font-weight: 400;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 16px 48px 0 48px;
            margin: 0;
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
            height: 4px;
            background: #16b12b;
            margin-bottom: 6px;
            border-radius: 2px;
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
        
        <!-- Background Information Page -->
          ${populatedBackgroundInformation}
        <div class="page-break"></div>
        
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
 * Generate site plan content page HTML
 * @param {Object} data - Clearance data
 * @param {string} appendixLetter - Appendix letter (B, C, etc.)
 * @param {string} logoBase64 - Base64 encoded logo
 * @returns {string} - HTML for site plan content page
 */
const generateSitePlanContentPage = (data, appendixLetter = 'B', logoBase64, fileField = 'sitePlanFile', title = 'SITE PLAN', figureTitle = 'Asbestos Removal Site Plan') => {
  // Determine the file type and create appropriate HTML
  const fileData = data[fileField];
  const fileType = fileData.startsWith('/9j/') ? 'image/jpeg' : 
                  fileData.startsWith('iVBORw0KGgo') ? 'image/png' : 
                  'application/pdf';
  
  let content = '';
  
  if (fileType.startsWith('image/')) {
    // For images, embed directly with caption
    content = `
      <div class="file-container" style="width: calc(100% - 96px); margin: 0 auto; padding: 0;">
        <img src="data:${fileType};base64,${fileData}" 
             alt="${title}" 
             style="width: 100%; height: auto; object-fit: contain; display: block;" />
        <div style="font-size: 14px; font-weight: 600; color: #222; text-align: center; margin-top: 10px;">
          Figure 1: ${figureTitle}
        </div>
      </div>
    `;
  } else {
    // For PDFs, show a placeholder (PDFs will be merged separately)
    content = `
      <div class="file-content">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text">${title}</div>
          <div class="file-note">Document attached</div>
        </div>
      </div>
    `;
  }
  
  return `
        <div class="page">
          <div class="header">
            <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
            <div class="company-details">
              Lancaster & Dickenson Consulting Pty Ltd<br />
              4/6 Dacre Street<br />
              Mitchell ACT 2911<br />
              W: <span class="website">www.landd.com.au</span>
            </div>
          </div>
          <div class="green-line"></div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <div class="footer-line"></div>
            Asbestos Assessment Report: ${data.projectId?.name || data.siteName || 'Unknown Site'}
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
    console.log('=== PDF MERGING DEBUG ===');
    console.log('pdf1Buffer length:', pdf1Buffer.length);
    console.log('pdf2Base64 length:', pdf2Base64 ? pdf2Base64.length : 'null/undefined');
    console.log('pdf2Base64 starts with:', pdf2Base64 ? pdf2Base64.substring(0, 50) : 'N/A');
    
    // Create a new PDF document
    const mergedPdf = await PDFDocument.create();
    console.log('Created merged PDF document');
    
    // Load the first PDF (clearance report)
    const pdf1Doc = await PDFDocument.load(pdf1Buffer);
    console.log('Loaded clearance PDF, pages:', pdf1Doc.getPageCount());
    const pdf1Pages = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
    pdf1Pages.forEach((page) => mergedPdf.addPage(page));
    console.log('Added clearance pages to merged PDF');
    
    // Load the second PDF (air monitoring report or site plan) from base64
    // Handle both pure base64 and data URL formats
    let cleanBase64 = pdf2Base64;
    if (pdf2Base64.startsWith('data:')) {
      cleanBase64 = pdf2Base64.split(',')[1];
      console.log('Removed data URL prefix from second PDF');
    }
    const pdf2Buffer = Buffer.from(cleanBase64, 'base64');
    console.log('Converted base64 to buffer, length:', pdf2Buffer.length);
    const pdf2Doc = await PDFDocument.load(pdf2Buffer);
    console.log('Loaded second PDF, pages:', pdf2Doc.getPageCount());
    const pdf2Pages = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
    pdf2Pages.forEach((page) => mergedPdf.addPage(page));
    console.log('Added second PDF pages to merged PDF');
    
    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save();
    console.log('Saved merged PDF, total pages:', mergedPdf.getPageCount());
    console.log('=== PDF MERGING COMPLETED ===');
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
  console.log('\n>>>>> CLEARANCE_TYPE_CHECK:', {
    type: req.body?.clearanceData?.clearanceType,
    route: 'generate-asbestos-clearance-v2'
  });
  console.log(`[${pdfId}] === CLEARANCE V2 REQUEST RECEIVED ===`);
  console.log(`[${pdfId}] Request headers:`, req.headers);
      console.log(`>>>>> STRUCTURE_CHECK:`, {
      hasData: !!req.body?.clearanceData,
      type: req.body?.clearanceData?.clearanceType,
      dataKeys: Object.keys(req.body?.clearanceData || {}).filter(k => !['sitePlanFile', 'airMonitoringReport', 'photograph'].includes(k))
    });
  backendPerformanceMonitor.startStage('request-received', pdfId);
  
  try {
    const { clearanceData } = req.body;
    
    if (!clearanceData) {
      return res.status(400).json({ error: 'Clearance data is required' });
    }

    console.log(`[${pdfId}] Generating clearance V2 PDF for data:`, clearanceData);
    backendPerformanceMonitor.startStage('data-validation', pdfId);

    // Validate clearance data
    if (!clearanceData._id && !clearanceData.projectId) {
      return res.status(400).json({ error: 'Invalid clearance data' });
    }

    backendPerformanceMonitor.endStage('data-validation', pdfId);
    backendPerformanceMonitor.startStage('template-population', pdfId);

    // Generate HTML content using new templates
    console.log(`[${pdfId}] Generating clearance HTML V2...`);
    const htmlContent = await generateClearanceHTMLV2(clearanceData);
    
    console.log(`[${pdfId}] HTML content generated, size: ${htmlContent.length} characters`);
    console.log(`[${pdfId}] HTML preview (first 500 chars):`, htmlContent.substring(0, 500));

    backendPerformanceMonitor.endStage('template-population', pdfId);
    backendPerformanceMonitor.startStage('docraptor-generation', pdfId);

    // Generate filename
    const projectId = clearanceData.projectId?.projectID || clearanceData.project?.projectID || clearanceData.projectId || 'Unknown';
    const siteName = clearanceData.projectId?.name || clearanceData.project?.name || clearanceData.siteName || 'Unknown';
    const clearanceDate = clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
    const clearanceType = clearanceData.clearanceType || 'Non-friable';
    const filename = `${projectId}_${clearanceType} Asbestos Clearance Certificate_${siteName} (${clearanceDate}).pdf`;

    console.log(`[${pdfId}] Generating PDF with DocRaptor V2...`);
    
    // Generate PDF using DocRaptor with optimized settings
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent, {
      // DocRaptor-specific options for better page handling
      page_size: 'A4',
      prince_options: {
        page_margin: '0',
        media: 'print',
        html_mode: 'quirks'  // Force consistent rendering
      }
    });

    backendPerformanceMonitor.endStage('docraptor-generation', pdfId);
    backendPerformanceMonitor.startStage('response-sending', pdfId);

    console.log(`[${pdfId}] PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Handle PDF merging for site plan and air monitoring reports
    let finalPdfBuffer = pdfBuffer;

    // If there's an air monitoring report, merge it with the generated PDF
    if (clearanceData.airMonitoringReport) {
      console.log(`[${pdfId}] === AIR MONITORING REPORT DEBUG ===`);
      console.log(`[${pdfId}] airMonitoringReport exists:`, !!clearanceData.airMonitoringReport);
      console.log(`[${pdfId}] airMonitoringReport type:`, typeof clearanceData.airMonitoringReport);
      console.log(`[${pdfId}] airMonitoringReport length:`, clearanceData.airMonitoringReport ? clearanceData.airMonitoringReport.length : 'N/A');
      console.log(`[${pdfId}] airMonitoringReport starts with:`, clearanceData.airMonitoringReport ? clearanceData.airMonitoringReport.substring(0, 100) : 'N/A');
      
      try {
        // Now that frontend generates PDFs, airMonitoringReport should always be base64 data
        console.log(`[${pdfId}] Merging air monitoring report with clearance PDF...`);
        const mergedPdf = await mergePDFs(finalPdfBuffer, clearanceData.airMonitoringReport);
        console.log(`[${pdfId}] PDFs merged successfully, new size:`, mergedPdf.length);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`[${pdfId}] Error merging air monitoring PDFs:`, error);
        console.log(`[${pdfId}] Returning PDF without air monitoring report`);
      }
    } else {
      console.log(`[${pdfId}] No air monitoring report found in data`);
    }

    // If there's a site plan PDF, merge it with the generated PDF
    if (clearanceData.sitePlan && clearanceData.sitePlanFile && !clearanceData.sitePlanFile.startsWith('/9j/') && !clearanceData.sitePlanFile.startsWith('iVBORw0KGgo')) {
      console.log(`[${pdfId}] === SITE PLAN PDF DEBUG ===`);
      console.log(`[${pdfId}] sitePlanFile exists:`, !!clearanceData.sitePlanFile);
      console.log(`[${pdfId}] sitePlanFile type:`, typeof clearanceData.sitePlanFile);
      console.log(`[${pdfId}] sitePlanFile length:`, clearanceData.sitePlanFile ? clearanceData.sitePlanFile.length : 'N/A');
      
      try {
        console.log(`[${pdfId}] Merging site plan PDF with clearance PDF...`);
        const mergedPdf = await mergePDFs(finalPdfBuffer, clearanceData.sitePlanFile);
        console.log(`[${pdfId}] PDFs merged successfully, new size:`, mergedPdf.length);
        finalPdfBuffer = mergedPdf; // Update the final buffer
      } catch (error) {
        console.error(`[${pdfId}] Error merging site plan PDFs:`, error);
        console.log(`[${pdfId}] Returning PDF without site plan`);
      }
    } else {
      console.log(`[${pdfId}] No site plan PDF found in data or site plan is an image`);
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', finalPdfBuffer.length);

    // Send final PDF buffer
    res.send(finalPdfBuffer);

    backendPerformanceMonitor.endStage('response-sending', pdfId);
    console.log(`[${pdfId}] Clearance V2 PDF generation completed successfully`);

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
    console.log('Testing DocRaptor V2 with simple HTML...');
    
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
    console.log('Testing DocRaptor SVG scaling...');
    
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
    console.log('Testing DocRaptor SVG viewBox and clipping...');
    
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
    console.log('Testing DocRaptor SVG coordinate mapping...');
    
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
    console.log('Testing minimal cover page structure...');
    
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
    console.log('Testing different A4 dimensions...');
    
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
    console.log('Testing SVG without viewBox...');
    
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
  backendPerformanceMonitor.startStage('template-population', pdfId);

  try {
    const { assessmentData } = req.body;
    if (!assessmentData) {
      throw new Error('Assessment data is required');
    }

    // Generate HTML content
    const html = await generateAssessmentHTML(assessmentData);
    backendPerformanceMonitor.endStage('template-population', pdfId);

    // Generate PDF with DocRaptor
    backendPerformanceMonitor.startStage('docraptor-generation', pdfId);
    console.log('Generating PDF with DocRaptor V2...');
    const pdfBuffer = await docRaptorService.generatePDF(html);
    backendPerformanceMonitor.endStage('docraptor-generation', pdfId);

    // Send response
    backendPerformanceMonitor.startStage('response-sending', pdfId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    backendPerformanceMonitor.endStage('response-sending', pdfId);

    console.log(`[${pdfId}] PDF generated successfully, size: ${pdfBuffer.length} bytes`);

  } catch (error) {
    console.error('Error generating assessment PDF:', error);
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
    const appendixACoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixACover.html'), 'utf8');
    const appendixBCoverTemplate = fs.readFileSync(path.join(templateDir, 'AppendixBCover.html'), 'utf8');
    
    // Load logo and background images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Fetch template content from database
    const templateContent = await getTemplateByType('asbestosAssessment');

    // Populate cover template with data
    const populatedCover = coverTemplate
      .replace(/\[REPORT_TYPE\]/g, 'Asbestos Assessment')
      .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[JOB_REFERENCE\]/g, assessmentData.projectId?.projectID || 'Unknown')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[BACKGROUND_IMAGE\]/g, `data:image/jpeg;base64,${backgroundBase64}`);

    // Populate version control template with data
    const populatedVersionControl = versionControlTemplate
      .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[CLIENT_NAME\]/g, assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client')
      .replace(/\[ASSESSMENT_DATE\]/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
      .replace(/\[ASSESSOR_NAME\]/g, assessmentData.assessorId?.firstName ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : 'Unknown Assessor')
      .replace(/\[FILENAME\]/g, `${assessmentData.projectId?.projectID || 'Unknown'}_${assessmentData.projectId?.name || 'Unknown'}_Assessment.pdf`)
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

    // Generate first sample register item for the main page
    const assessmentItems = assessmentData.items || [];
    const scopeBulletCount = assessmentItems.length;
    const shouldMoveFirstItemToNewPage = scopeBulletCount > 5;
    const firstSampleItem = assessmentItems.length > 0 ? assessmentItems[0] : null;
    const firstSampleTable = firstSampleItem ? asbestosSampleItemTemplate
      .replace(/\[PHOTO_URL\]/g, firstSampleItem.photograph || '')
      .replace(/\[SAMPLE_REFERENCE\]/g, firstSampleItem.sampleReference || 'Sample 1')
      .replace(/\[LOCATION_DESCRIPTION\]/g, firstSampleItem.locationDescription || 'Unknown Location')
      .replace(/\[MATERIAL_TYPE\]/g, firstSampleItem.materialType || 'Unknown Material')
      .replace(/\[ASBESTOS_CONTENT\]/g, firstSampleItem.asbestosContent || 'Not tested')
      .replace(/\[ASBESTOS_TYPE\]/g, firstSampleItem.asbestosType || 'Not applicable')
      .replace(/\[CONDITION\]/g, firstSampleItem.condition || 'Unknown')
      .replace(/\[RISK\]/g, firstSampleItem.risk || 'Unknown')
      .replace(/\[COMMENTS\]/g, firstSampleItem.recommendationActions || 'No comments') : '';

    // Generate sample register items as separate pages
    let sampleRegisterPages = '';
    
    if (shouldMoveFirstItemToNewPage) {
      // For 6+ items: First item starts new page, then 2 items per page
      const itemsForSeparatePages = assessmentItems;
      const pages = [];
      
      for (let i = 0; i < itemsForSeparatePages.length; i += 2) {
        const pageItems = itemsForSeparatePages.slice(i, i + 2);
        const pageContent = pageItems.map((item, pageIndex) => {
          const sampleTable = asbestosSampleItemTemplate
            .replace(/\[PHOTO_URL\]/g, item.photograph || '')
            .replace(/\[SAMPLE_REFERENCE\]/g, item.sampleReference || `Sample ${i + pageIndex + 1}`)
            .replace(/\[LOCATION_DESCRIPTION\]/g, item.locationDescription || 'Unknown Location')
            .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
            .replace(/\[ASBESTOS_CONTENT\]/g, item.asbestosContent || 'Not tested')
            .replace(/\[ASBESTOS_TYPE\]/g, item.asbestosType || 'Not applicable')
            .replace(/\[CONDITION\]/g, item.condition || 'Unknown')
            .replace(/\[RISK\]/g, item.risk || 'Unknown')
            .replace(/\[COMMENTS\]/g, item.recommendationActions || 'No comments');
          
          return `
            <div class="sample-register-header">Sample Register - Item ${i + pageIndex + 1}</div>
            ${sampleTable}
          `;
        }).join('');
        
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                W: <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-line"></div>
              Asbestos Assessment Report - ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}
            </div>
          </div>
        `);
      }
      
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    } else {
      // For ≤5 items: First item on main page, remaining items on separate pages (2 per page)
      const remainingItems = assessmentItems.slice(1);
      const pages = [];
      
      for (let i = 0; i < remainingItems.length; i += 2) {
        const pageItems = remainingItems.slice(i, i + 2);
        const pageContent = pageItems.map((item, pageIndex) => {
          const sampleTable = asbestosSampleItemTemplate
            .replace(/\[PHOTO_URL\]/g, item.photograph || '')
            .replace(/\[SAMPLE_REFERENCE\]/g, item.sampleReference || `Sample ${i + pageIndex + 2}`)
            .replace(/\[LOCATION_DESCRIPTION\]/g, item.locationDescription || 'Unknown Location')
            .replace(/\[MATERIAL_TYPE\]/g, item.materialType || 'Unknown Material')
            .replace(/\[ASBESTOS_CONTENT\]/g, item.asbestosContent || 'Not tested')
            .replace(/\[ASBESTOS_TYPE\]/g, item.asbestosType || 'Not applicable')
            .replace(/\[CONDITION\]/g, item.condition || 'Unknown')
            .replace(/\[RISK\]/g, item.risk || 'Unknown')
            .replace(/\[COMMENTS\]/g, item.recommendationActions || 'No comments');
          
          return `
            <div class="sample-register-header">Sample Register - Item ${i + pageIndex + 2}</div>
            ${sampleTable}
          `;
        }).join('<div style="margin-bottom: 20px;"></div>');
        
        pages.push(`
          <div class="assessment-page">
            <div class="header">
              <img class="logo" src="data:image/png;base64,${logoBase64}" alt="Company Logo" />
              <div class="company-details">
                Lancaster & Dickenson Consulting Pty Ltd<br />
                4/6 Dacre Street<br />
                Mitchell ACT 2911<br />
                W: <span class="website">www.landd.com.au</span>
              </div>
            </div>
            <div class="green-line"></div>
            <div class="content">
              ${pageContent}
            </div>
            <div class="footer">
              <div class="footer-line"></div>
              Asbestos Assessment Report - ${assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site'}
            </div>
          </div>
        `);
      }
      
      sampleRegisterPages = pages.join('<div class="page-break"></div>');
    }


    
    // Populate AsbestosItem1 template with dynamic content
    const populatedAsbestosItem1 = asbestosItem1Template
      .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[INTRODUCTION_TITLE\]/g, templateContent?.introductionTitle || 'INTRODUCTION')
      .replace(/\[INTRODUCTION_CONTENT\]/g, (templateContent?.introductionContent || 'Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake an asbestos assessment at {SITE_NAME}. {LAA_NAME} (Licenced Asbestos Assessor - {LAA_LICENSE}) from L & D subsequently visited the above location on {ASSESSMENT_DATE} to undertake the assessment.\n\nThis report covers the inspection and assessment of the following areas/materials only:\n{ASSESSMENT_SCOPE_BULLETS}')
        .replace(/\{CLIENT_NAME\}/g, assessmentData.projectId?.client?.name || assessmentData.clientName || 'Unknown Client')
        .replace(/\{SITE_NAME\}/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\{LAA_NAME\}/g, assessmentData.assessorId?.firstName ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : 'Unknown Assessor')
        .replace(/\{LAA_LICENSE\}/g, 'AA00031') // Default license - will be looked up in replacePlaceholders
        .replace(/\{ASSESSMENT_DATE\}/g, assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB') : 'Unknown')
        .replace(/\{ASSESSMENT_SCOPE_BULLETS\}/g, assessmentItems.map(item => `<li>${item.locationDescription || 'Unknown Location'}</li>`).join('')))
      .replace(/\[SURVEY_FINDINGS_TITLE\]/g, templateContent?.surveyFindingsTitle || 'SURVEY FINDINGS')
      .replace(/\[SURVEY_FINDINGS_CONTENT\]/g, templateContent?.surveyFindingsContent || 'Table 1 below details the suspected ACM sampled as part of the assessment. Information is also included regarding materials which are presumed to contain asbestos and materials which the assessor visually assessed to be the consistent with a sampled material. Photographs of assessed materials are also presented in the sample register below.\n\nSample analysis was undertaken by L&D\'s National Association of Testing Authorities (NATA) accredited laboratory. The samples were analysed by Polarised Light Microscopy using dispersion staining techniques in accordance with AS 4964-2004.')
      .replace(/\[SAMPLE_REGISTER_ITEMS\]/g, shouldMoveFirstItemToNewPage ? '' : firstSampleTable); // Conditionally include the first sample table

    // Populate Discussion and Conclusions template with dynamic content
    const identifiedAsbestosItems = assessmentItems.filter(item => 
      item.asbestosContent && item.asbestosContent.toLowerCase() !== 'not tested' && 
      item.asbestosContent.toLowerCase() !== 'not applicable' && 
      item.asbestosContent.toLowerCase() !== 'none detected'
    );

    const identifiedAsbestosList = identifiedAsbestosItems.length > 0 
      ? identifiedAsbestosItems.map(item => `<li>${item.locationDescription || 'Unknown Location'} - ${item.materialType || 'Unknown Material'} (${item.asbestosContent || 'Unknown Content'})</li>`).join('')
      : '<li>No asbestos-containing materials were identified during this assessment.</li>';

    const populatedDiscussionConclusions = asbestosDiscussionConclusionsTemplate
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[IDENTIFIED_ASBESTOS_ITEMS\]/g, identifiedAsbestosList)
      .replace(/\[SIGNATURE_IMAGE\]/g, '') // Placeholder for signature - can be added later if needed
      .replace(/\[LAA_NAME\]/g, assessmentData.assessorId?.firstName ? `${assessmentData.assessorId.firstName} ${assessmentData.assessorId.lastName}` : 'Unknown Assessor')
      .replace(/\[LAA_LICENCE\]/g, 'AA00031') // Default license - will be looked up in replacePlaceholders
      .replace(/\[SITE_NAME\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site');



    // Generate two pages of additional sections with proper content distribution
    const sections = [
      {
        title: templateContent?.riskAssessmentTitle || 'RISK ASSESSMENT',
        content: templateContent?.riskAssessmentContent || 'Identified ACM was risk assessed based on the following criteria:\n• the condition of the material at the time of the assessment;\n• the accessibility of the material;\n• the likelihood of the material being disturbed resulting in a release of asbestos fibre.\nEach ACM is categorised into one of four (4) risk categories:'
      },
      {
        title: templateContent?.controlMeasuresTitle || 'DETERMINING SUITABLE CONTROL MEASURES',
        content: templateContent?.controlMeasuresContent || 'The Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022 requires that when choosing the most appropriate control measure for managing ACM or asbestos, the following hierarchy of controls must be considered:\n• eliminating the risk, for example: removing the asbestos (most preferred)\n• substituting for the risk, isolating the risk or applying engineering controls, for example: enclosing, encapsulation or sealing\n• using administrative controls, for example: labelling, safe work practices etc.\n• using PPE (least preferred)\nA combination of these controls may be required in order to adequately manage and control asbestos or ACM.'
      },
      {
        title: templateContent?.remediationRequirementsTitle || 'REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM',
        content: templateContent?.remediationRequirementsContent || 'Prior to Work Commencing\nPrior to the commencement of any works associated with asbestos, the licensed asbestos removalist is required to notify Worksafe ACT five (5) days prior to commencement of asbestos removal works. As part of the notification process the licensed removalist must supply an Asbestos Removal Control Plan (ARCP) and a Safe Work Method Statement (SWMS) outlining how the works are to be undertaken.\n\nAsbestos Removal Works\nFriable asbestos removal or remediation work must be undertaken by an ACT licensed Class A Asbestos Removalist. Air monitoring, which is mandatory during the removal or remediation of friable asbestos, must be undertaken in accordance with the Guidance Note on the Membrane Filter Method for Estimating Airborne Asbestos Fibres, 2nd Edition [NOHSC: 3003(2005)].\n\nNon-friable asbestos removal or remediation must be undertaken by a Class A or B Asbestos Removalist. Air monitoring is not mandatory for the removal of non-friable asbestos.\n\nAll asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022) and in accordance with EPA (2011) Contaminated Sites Information Sheet No. 5 \'Requirements for the Transport and Disposal of Asbestos Contaminated Wastes\' and Information Sheet No.6 \'Management of Small Scale, Low Risk Soil Asbestos Contamination\'.\n\nFollowing Completion of Asbestos Removal Works\nOn completion of asbestos removal or remediation works an independent ACT licensed Asbestos Assessor must be employed to undertake a Clearance Inspection. A satisfactory clearance certificate for the remediated areas must include no visible suspect material and where applicable, clearance monitoring must also indicate that airborne fibre levels are satisfactory.'
      },
      {
        title: templateContent?.legislationTitle || 'LEGISLATION',
        content: templateContent?.legislationContent || 'This report was written in general accordance with and with reference to:\n• ACT Work Health and Safety (WHS) Act 2011\n• ACT Work Health and Safety Regulation 2011\n• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) Approval 2022\n• ACT Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022'
      },
      {
        title: templateContent?.assessmentLimitationsTitle || 'ASSESSMENT LIMITATIONS/CAVEATS',
        content: templateContent?.assessmentLimitationsContent || 'This report covers the inspection and assessment of the location and materials outlined within this document only and is specific to the date the assessment was conducted. L&D did not inspect any areas of the property that fall outside of the locations listed in this report and therefore make no comment regarding the presence or condition of further ACM that may or may not be present.\n\nWhilst every effort has been made to identify all ACM within the inspected areas, the random nature in which asbestos was often installed can mean unidentified asbestos may be uncovered/identified. Should suspect ACM be identified or disturbed, works should cease until an assessment of the materials is completed.'
      }
    ];

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

    // Generate first page content (first 3 sections)
    const firstPageContent = sections.slice(0, 3).map(section => 
      `<div class="section-header">${section.title}</div>${convertContentToHtml(section.content)}`
    ).join('');

    // Generate second page content (last 2 sections)
    const secondPageContent = sections.slice(3).map(section => 
      `<div class="section-header">${section.title}</div>${convertContentToHtml(section.content)}`
    ).join('');

    const populatedAdditionalSectionsPage1 = asbestosAdditionalSectionsTemplate
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, firstPageContent)
      .replace(/\[SITE_NAME\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site');

    const populatedAdditionalSectionsPage2 = asbestosAdditionalSectionsTemplate
      .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
      .replace(/\[ADDITIONAL_SECTIONS_CONTENT\]/g, secondPageContent)
      .replace(/\[SITE_NAME\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site');

    // Generate dynamic appendix content
    let appendixContent = '';

    // Add Certificate of Analysis cover page if there are asbestos items
    if (assessmentItems.length > 0) {
      const populatedAppendixACover = appendixACoverTemplate
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

      appendixContent += `
          <!-- Appendix A Cover Page - Certificate of Analysis -->
          ${populatedAppendixACover}
      `;

      // Add analysis certificate content if it exists
      if (assessmentData.analysisCertificate && assessmentData.analysisCertificateFile) {
        const isAnalysisCertificateImage = assessmentData.analysisCertificateFile && (
          assessmentData.analysisCertificateFile.startsWith('/9j/') || 
          assessmentData.analysisCertificateFile.startsWith('iVBORw0KGgo')
        );

        if (isAnalysisCertificateImage) {
          const analysisCertificateContentPage = generateSitePlanContentPage(assessmentData, 'A', logoBase64, 'analysisCertificateFile', 'CERTIFICATE OF ANALYSIS', 'Analysis Certificate');
          appendixContent += `
              <!-- Appendix A Analysis Certificate Content Page -->
              ${analysisCertificateContentPage}
          `;
        }
      }
    }

    // Add site plan if it exists
    if (assessmentData.sitePlan && assessmentData.sitePlanFile) {
      const populatedAppendixBCover = appendixBCoverTemplate
        .replace(/\[SITE_ADDRESS\]/g, assessmentData.projectId?.name || assessmentData.siteName || 'Unknown Site')
        .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`);

      appendixContent += `
          <!-- Appendix B Cover Page -->
          ${populatedAppendixBCover}
      `;

      // Add site plan content page if it's an image
      const isSitePlanImage = assessmentData.sitePlanFile && (
        assessmentData.sitePlanFile.startsWith('/9j/') || 
        assessmentData.sitePlanFile.startsWith('iVBORw0KGgo')
      );

      if (isSitePlanImage) {
        const sitePlanContentPage = generateSitePlanContentPage(assessmentData, 'B', logoBase64);
        appendixContent += `
            <!-- Appendix B Site Plan Content Page -->
            ${sitePlanContentPage}
        `;
      }
    }

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
        
        <!-- Sample Register Pages -->
        ${sampleRegisterPages}
        <div class="page-break"></div>
        
        <!-- Discussion and Conclusions Page -->
        ${populatedDiscussionConclusions}
        <div class="page-break"></div>
        
        <!-- Additional Sections Page 1 -->
        ${populatedAdditionalSectionsPage1}
        <div class="page-break"></div>
        
        <!-- Additional Sections Page 2 -->
        ${populatedAdditionalSectionsPage2}
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

const generateAssessmentPhotographsContent = (items) => {
  if (!items || items.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Filter out items that don't have photographs
  const itemsWithPhotos = items.filter(item => 
    item.photograph && item.photograph.trim() !== ''
  );

  if (itemsWithPhotos.length === 0) {
    return '<div class="photo-container"><div class="photo"><div class="photo-placeholder">No photographs available</div></div></div>';
  }

  // Split photos into pages of 2 photos each
  const pages = [];
  for (let i = 0; i < itemsWithPhotos.length; i += 2) {
    const pageItems = itemsWithPhotos.slice(i, i + 2);
    const pageContent = pageItems.map((item, index) => {
      const photoNumber = i + index + 1;
      return `
        <div class="photo-container">
          <div class="photo">
            <img src="${item.photograph}" alt="Assessment Photo ${photoNumber}" />
          </div>
          <div class="photo-details">
            <div class="photo-number">Photo ${photoNumber}</div>
            <div class="photo-location">${item.locationDescription || 'Unknown Location'}</div>
            <div class="photo-materials">${item.materialDescription || 'Unknown Material'}</div>
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
            W: <span class="website">www.landd.com.au</span>
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
      ${i + 2 < itemsWithPhotos.length ? '<div class="page-break"></div>' : ''}
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