const express = require('express');
const router = express.Router();
const DocRaptorService = require('../services/docraptorService');
const fs = require('fs');
const path = require('path');
const { getTemplateByType, replacePlaceholders } = require('../services/templateService');
const { PDFDocument } = require('pdf-lib');

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
    const photographsTemplate = fs.readFileSync(path.join(templateDir, 'AsbestosClearancePhotographs.html'), 'utf8');
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
      .replace(/\[LAA_NAME\]/g, clearanceData.laaName || 'Unknown LAA')
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
      
      const tableRows = items.map((item, index) => 
        `<tr>
            <td>${index + 1}</td>
          <td>${item.locationDescription || 'Unknown Location'}</td>
          <td>${item.materialDescription || 'Unknown Material'}</td>
          <td>${item.asbestosType || 'Non-friable'}</td>
        </tr>`
      ).join('');
      
      console.log('Generated table rows:', tableRows);
      return tableRows;
    };

    // Generate photographs content
    const generatePhotographsContent = () => {
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
      
      // Only generate content for the first 2 photos (first photo page)
      const firstPageItems = itemsWithPhotos.slice(0, 2);
      
      return firstPageItems.map((item, index) => {
        const photoNumber = index + 1;
          
          return `
            <!-- Photo ${photoNumber} -->
            <div class="photo-container">
              <div class="photo">
                <img src="${item.photograph}" alt="Photograph ${photoNumber}" style="width: 100%; height: 100%; object-fit: contain;" />
              </div>
              <div class="photo-details">
                <div class="photo-number">Photograph ${photoNumber}</div>
              <div class="photo-location">
                ${item.locationDescription || 'Unknown Location'}
              </div>
                <div class="photo-materials">
                ${item.materialDescription || 'Unknown Material'}
                </div>
              </div>
            </div>
          `;
        }).join('');
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

      const populatedPhotographs = extractPageContent(
        photographsTemplate
          .replace(/\[REPORT_TYPE\]/g, clearanceData.clearanceType || 'Non-Friable')
          .replace(/\[SITE_ADDRESS\]/g, clearanceData.projectId?.name || clearanceData.siteName || 'Unknown Site')
          .replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)
          .replace(/\[PHOTOGRAPHS_CONTENT\]/g, generatePhotographsContent())
      );

      appendixContent += `
          <!-- Appendix A Cover Page -->
          ${populatedAppendixACover}
          
          <!-- Photographs Page -->
          ${populatedPhotographs}
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
        const sitePlanContentPage = extractPageContent(generateSitePlanContentPage(clearanceData, 'B', logoBase64));
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
const generateSitePlanContentPage = (data, appendixLetter = 'B', logoBase64) => {
  // Determine the file type and create appropriate HTML
  const fileType = data.sitePlanFile.startsWith('/9j/') ? 'image/jpeg' : 
                  data.sitePlanFile.startsWith('iVBORw0KGgo') ? 'image/png' : 
                  'application/pdf';
  
  let sitePlanContent = '';
  
  if (fileType.startsWith('image/')) {
    // For images, embed directly with caption
    sitePlanContent = `
      <div class="site-plan-container" style="width: 85vw; margin: 0; padding: 0;">
        <img src="data:${fileType};base64,${data.sitePlanFile}" 
             alt="Site Plan" 
             style="width: 100vw; height: auto; object-fit: contain; display: block;" />
        <div style="font-size: 14px; font-weight: 600; color: #222; text-align: center; margin-top: 10px;">
          Figure 1: Asbestos Removal Site Plan
        </div>
      </div>
    `;
  } else {
    // For PDFs, show a placeholder (PDFs will be merged separately)
    sitePlanContent = `
      <div class="site-plan-content">
        <div class="centered-text">
          <div class="appendix-title">APPENDIX ${appendixLetter}</div>
          <div class="photographs-text">SITE PLAN</div>
          <div class="site-plan-note">Site plan document attached</div>
        </div>
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Asbestos Clearance Report - Site Plan</title>
        <link
          href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap"
          rel="stylesheet"
        />
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: "Montserrat", Arial, sans-serif;
            background: #fff;
            width: 100%;
            height: 100%;
          }
          .page {
            width: 100%;
            height: 100vh;
            position: relative;
            background: #fff;
            margin: 0;
            padding: 0;
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
          .green-line {
            width: calc(100% - 96px);
            height: 4px;
            background: #16b12b;
            margin: 8px auto 0 auto;
            border-radius: 2px;
          }
          .content {
            padding: 0;
            margin: 0;
            width: 100vw;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
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
        </style>
      </head>
      <body>
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
            ${sitePlanContent}
          </div>
          <div class="footer">
            <div class="footer-line"></div>
            ${data.clearanceType || 'Non-friable'} Clearance Certificate: ${data.projectId?.name || data.project?.name || 'Unknown Site'}
          </div>
        </div>
      </body>
      </html>
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
    const filename = `${projectId}_${clearanceType}_Clearance_V2_${siteName}_${clearanceDate}.pdf`;

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

module.exports = router; 