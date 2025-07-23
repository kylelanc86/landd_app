const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { getTemplateByType, replacePlaceholders, clearUserLookupCache } = require('../services/templateService');

// Performance monitoring utility
const backendPerformanceMonitor = {
  timers: {},
  stages: {},

  startTimer(name) {
    this.timers[name] = {
      start: Date.now(),
      end: null,
      duration: null
    };
    console.log(`[Backend Performance] Started timer: ${name}`);
  },

  endTimer(name) {
    if (this.timers[name]) {
      this.timers[name].end = Date.now();
      this.timers[name].duration = this.timers[name].end - this.timers[name].start;
      console.log(`[Backend Performance] Timer ${name} completed in ${this.timers[name].duration}ms`);
      delete this.timers[name];
    }
  },

  startStage(stageName, pdfId = 'default') {
    if (!this.stages[pdfId]) {
      this.stages[pdfId] = {};
    }
    this.stages[pdfId][stageName] = {
      start: Date.now(),
      end: null,
      duration: null
    };
    console.log(`[Backend Performance] Started stage: ${stageName} for PDF ${pdfId}`);
  },

  endStage(stageName, pdfId = 'default') {
    if (this.stages[pdfId] && this.stages[pdfId][stageName]) {
      this.stages[pdfId][stageName].end = Date.now();
      this.stages[pdfId][stageName].duration = this.stages[pdfId][stageName].end - this.stages[pdfId][stageName].start;
      console.log(`[Backend Performance] Stage ${stageName} completed in ${this.stages[pdfId][stageName].duration}ms for PDF ${pdfId}`);
    }
  }
};

// Global variables for images
let logoBase64 = null;
let backgroundBase64 = null;

// Load images function (same as existing)
const loadImages = () => {
  try {
    const logoPath = path.join(__dirname, '../assets/logo.png');
    
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
      console.log('[LOGO DEBUG] logoToUse length:', logoBase64.length);
      return { logoBase64 };
    } else {
      console.log('[LOGO DEBUG] Logo file not found, using default');
      return { logoBase64: null };
    }
  } catch (error) {
    console.error('Error loading images:', error);
    return { logoBase64: null };
  }
};

// Template population function (enhanced for clearance templates)
const populateTemplate = async (htmlTemplate, data, appendixLetter = 'B', logoBase64Param = null, backgroundBase64Param = null) => {
  try {
    console.log(`[POPULATE DEBUG] Starting template population...`);
    
    // Safety check for undefined template
    if (!htmlTemplate) {
      console.error('[POPULATE DEBUG] Template is undefined or null');
      return '<div>Template content not available</div>';
    }
    
    // Determine template type based on clearance type
    let templateType = 'asbestosClearanceNonFriable'; // default
    if (data.clearanceType === 'Friable') {
      templateType = 'asbestosClearanceFriable';
    }
    
    // Fetch template content based on clearance type
    let templateContent = null;
    try {
      console.log(`[POPULATE DEBUG] Fetching template content for type: ${templateType}`);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Template content fetch timeout')), 10000); // 10 second timeout
      });
      
      // Race between the template fetch and timeout
      templateContent = await Promise.race([
        getTemplateByType(templateType),
        timeoutPromise
      ]);
      
      console.log(`[POPULATE DEBUG] Template content fetched successfully`);
    } catch (error) {
      console.error('[POPULATE DEBUG] Error fetching template content:', error);
      // Continue with hardcoded content as fallback
    }

    // Replace placeholders using the template service
    let populatedContent = await replacePlaceholders(htmlTemplate, data);
    
    // Replace logo placeholders with actual img tags
    let templateWithLogoPath = populatedContent.replace(/\[LOGO_PATH\]/g, '');
    
    // Use passed logoBase64 parameter or fall back to global variable
    const logoToUse = logoBase64Param || logoBase64;
    
    // Simple fix: replace [LOGO_PATH] with base64 logo everywhere
    if (logoToUse) {
      templateWithLogoPath = templateWithLogoPath.replace(/\[LOGO_PATH\]/g, 'data:image/png;base64,' + logoToUse);
    }
    
    // Concise debug log for logo
    if (logoToUse) {
      console.log('[LOGO DEBUG] logoToUse length:', logoToUse.length, 'start:', logoToUse.slice(0, 10), 'end:', logoToUse.slice(-10));
    } else {
      console.log('[LOGO DEBUG] logoToUse is null or empty');
    }
    console.log('[LOGO DEBUG] logoBase64Param provided:', !!logoBase64Param);
    console.log('[LOGO DEBUG] Using global logoBase64:', !logoBase64Param);
    
    try {
      templateWithLogoPath = templateWithLogoPath.replace(
        /<img\s+class="logo"[^>]*>/g,
        '<img class="logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
    } catch (error) {
      console.log('Logo img replacement failed: ' + error.message);
    }
    
    try {
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div\s+class="logo"[^>]*>/g,
        '<img class="logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" />'
      );
    } catch (error) {
      console.error('Logo div replacement failed:', error);
    }
    
    // Add background image as simple img tag for cover page
    if (htmlTemplate && htmlTemplate.includes('cover-bg')) {
      try {
        // Use passed backgroundBase64 parameter or fall back to global variable
        const backgroundToUse = backgroundBase64Param || backgroundBase64;
        
        // Remove the original background div completely
        templateWithLogoPath = templateWithLogoPath.replace(
          /<div\s+class="cover-bg"[^>]*><\/div>/g,
          ''
        );
        
        // Add simple background image at the start of cover-container
        templateWithLogoPath = templateWithLogoPath.replace(
          /<div class="cover-container">/g,
          '<div class="cover-container"><img src="data:image/jpeg;base64,' + backgroundToUse + '" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" /><svg style="position: absolute; top: 0; left: 0; width: 432px; height: 100%; z-index: 1; fill: white;" viewBox="0 0 432 1130" xmlns="http://www.w3.org/2000/svg"><polygon points="80,-10 426,240 426,884 80,1134 0,1134 0,0" /></svg>'
        );
      } catch (error) {
        console.error('Background image addition failed:', error);
      }
    }
    
    // Replace cover logo div with img tag (handle inline styles)
    try {
      templateWithLogoPath = templateWithLogoPath.replace(
        /<div\s+class="cover-logo"[^>]*>/g,
        '<img class="cover-logo" src="data:image/png;base64,' + logoToUse + '" alt="Company Logo" style="max-width: 200px; max-height: 100px;" />'
      );
    } catch (error) {
      console.error('Cover logo replacement failed:', error);
    }
    
    // Handle background replacement
    if (backgroundBase64Param) {
      templateWithLogoPath = templateWithLogoPath.replace(/\[BACKGROUND_PATH\]/g, `data:image/jpeg;base64,${backgroundBase64Param}`);
    }
    
    return templateWithLogoPath;
  } catch (error) {
    console.error('Error populating template:', error);
    throw error;
  }
};

// Browserless PDF generation function
const generatePDFWithBrowserless = async (htmlContent, pdfId) => {
  try {
    backendPerformanceMonitor.startStage('browserless-api', pdfId);
    
    // Get API key from environment variable
    const apiKey = process.env.BROWSERLESS_API_KEY;
    console.log('[BROWSERLESS DEBUG] API Key exists:', !!apiKey);
    console.log('[BROWSERLESS DEBUG] API Key length:', apiKey ? apiKey.length : 0);
    if (!apiKey) {
      throw new Error('BROWSERLESS_API_KEY environment variable not set');
    }
    
    // Browserless API endpoint
    const browserlessUrl = 'https://production-sfo.browserless.io/pdf?token=' + apiKey;
    
    console.log('[BROWSERLESS] Sending HTML to Browserless API...');
    console.log('[BROWSERLESS] HTML content length:', htmlContent.length);
    
    // Prepare the request to Browserless
    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        html: htmlContent,
        options: {
          format: 'A4',
          margin: {
            top: '20mm',
            bottom: '20mm',
            left: '20mm',
            right: '20mm'
          },
          printBackground: true,
          displayHeaderFooter: false
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[BROWSERLESS] API Error:', response.status, errorText);
      throw new Error(`Browserless API error: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    console.log('[BROWSERLESS] PDF generated successfully, size:', pdfBuffer.length);
    
    backendPerformanceMonitor.endStage('browserless-api', pdfId);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('[BROWSERLESS] Error generating PDF:', error);
    throw error;
  }
};

// Assessment PDF generation using Browserless
const generateAssessmentPDFWithBrowserless = async (templateType, data) => {
  const pdfId = `browserless-assessment-${data._id || Date.now()}`;
  
  try {
    console.log(`[BROWSERLESS] Starting assessment PDF generation for ID: ${pdfId}`);
    backendPerformanceMonitor.startStage('template-loading', pdfId);
    
    // Load assessment-specific templates
    const templateDir = path.join(__dirname, '../templates/AsbestosAssessment');
    
    if (!fs.existsSync(templateDir)) {
      throw new Error(`Template directory not found: ${templateDir}`);
    }
    
    const templateFiles = {
      cover: 'AsbestosAssessmentCoverMockup-Page1.html',
      versionControl: 'AsbestosAssessmentVersionControlMockup-page2.html',
      sampleRegister: 'AsbestosAssessmentReportPage3.html',
      discussion: 'AsbestosAssessmentDiscussionConclusions.html',
      sampleItem: 'AsbestosAssessmentSampleRegisterItem.html',
      glossary: 'AsbestosAssessmentGlossary.html',
      appendixA: 'AsbestosAssessmentAppendixA.html'
    };
    
    // Load templates
    let coverTemplate, versionControlTemplate, sampleRegisterTemplate, discussionTemplate, sampleItemTemplate, glossaryTemplate, appendixATemplate;
    
    try {
      coverTemplate = fs.readFileSync(path.join(templateDir, templateFiles.cover), 'utf8');
      versionControlTemplate = fs.readFileSync(path.join(templateDir, templateFiles.versionControl), 'utf8');
      sampleRegisterTemplate = fs.readFileSync(path.join(templateDir, templateFiles.sampleRegister), 'utf8');
      discussionTemplate = fs.readFileSync(path.join(templateDir, templateFiles.discussion), 'utf8');
      sampleItemTemplate = fs.readFileSync(path.join(templateDir, templateFiles.sampleItem), 'utf8');
      glossaryTemplate = fs.readFileSync(path.join(templateDir, templateFiles.glossary), 'utf8');
      appendixATemplate = fs.readFileSync(path.join(templateDir, templateFiles.appendixA), 'utf8');
      
      console.log('[BROWSERLESS] All template files loaded successfully');
    } catch (error) {
      console.error('Error loading template files:', error);
      throw new Error(`Failed to load template files: ${error.message}`);
    }
    
    backendPerformanceMonitor.endStage('template-loading', pdfId);
    backendPerformanceMonitor.startStage('html-generation', pdfId);
    
    // Load images
    const { logoBase64 } = loadImages();
    const backgroundBase64 = null;
    
    // Generate assessment items
    const assessmentItems = data.assessmentItems || [];
    
    // Populate templates with data
    console.log(`[BROWSERLESS] Populating templates...`);
    const populatedCover = await populateTemplate(coverTemplate, data, 'B', logoBase64, backgroundBase64);
    const populatedVersionControl = await populateTemplate(versionControlTemplate, data, 'B', logoBase64);
    const populatedGlossary = await populateTemplate(glossaryTemplate, data, 'B', logoBase64);
    const populatedAppendixA = await populateTemplate(appendixATemplate, data, 'B', logoBase64);
    
    // Generate discussion content
    const identifiedAsbestosItems = assessmentItems
      .filter(item => item.asbestosContent && item.asbestosContent !== 'No asbestos detected')
      .map(item => `<li>${item.locationDescription} - ${item.materialType} (${item.asbestosContent})</li>`)
      .join('');
    
    const assessmentScopeBullets = assessmentItems
      .map(item => `<li>${item.locationDescription}</li>`)
      .join('');
    
    const placeholderData = {
      ...data,
      LAA: data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Assessor',
      CLIENT_NAME: data.projectId?.clientId?.name || data.CLIENT_NAME || 'Unknown Client',
      PROJECT_NAME: data.projectId?.name || data.PROJECT_NAME || 'Unknown Project',
      ASSESSMENT_DATE: data.assessmentDate ? new Date(data.assessmentDate).toLocaleDateString('en-GB') : 'Unknown Date',
      ASSESSMENT_SCOPE: assessmentScopeBullets,
      IDENTIFIED_ASBESTOS: identifiedAsbestosItems || '<li>No asbestos identified during this assessment</li>',
      ASSESSMENT_ITEMS: assessmentItems
    };
    
    const populatedDiscussion = await populateTemplate(discussionTemplate, placeholderData, 'B', logoBase64);
    
    // Generate sample register content
    let sampleRegisterContent = '';
    if (assessmentItems && assessmentItems.length > 0) {
      sampleRegisterContent = assessmentItems.map(item => {
        const itemData = {
          ...placeholderData,
          SAMPLE_ID: item.sampleId || 'N/A',
          LOCATION: item.locationDescription || 'N/A',
          MATERIAL_TYPE: item.materialType || 'N/A',
          ASBESTOS_CONTENT: item.asbestosContent || 'N/A',
          CONDITION: item.condition || 'N/A',
          ACCESSIBILITY: item.accessibility || 'N/A',
          RISK_RATING: item.riskRating || 'N/A'
        };
        return populateTemplate(sampleItemTemplate, itemData, 'B', logoBase64);
      }).join('');
    }
    
    const populatedSampleRegister = await populateTemplate(sampleRegisterTemplate, {
      ...placeholderData,
      SAMPLE_ITEMS: sampleRegisterContent
    }, 'B', logoBase64);
    
    // Combine all HTML content
    const fullHTML = populatedCover + populatedVersionControl + populatedSampleRegister + populatedDiscussion + populatedGlossary + populatedAppendixA;
    
    backendPerformanceMonitor.endStage('html-generation', pdfId);
    
    // Generate PDF using Browserless
    const pdfBuffer = await generatePDFWithBrowserless(fullHTML, pdfId);
    
    // Clear user lookup cache
    clearUserLookupCache();
    
    const totalTime = Date.now() - backendPerformanceMonitor.stages[pdfId]['template-loading'].start;
    console.log(`[BROWSERLESS] Total generation time: ${totalTime}ms`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('=== BROWSERLESS ASSESSMENT PDF ERROR ===');
    console.error('Error generating assessment PDF:', error);
    console.error('Error stack:', error.stack);
    
    // Clear user lookup cache on error
    clearUserLookupCache();
    
    throw error;
  }
};

// Clearance PDF generation using Browserless - fixed implementation
const generateClearancePDFWithBrowserless = async (templateType, data) => {
  const pdfId = `browserless-clearance-${data._id || Date.now()}`;
  
  try {
    console.log(`[BROWSERLESS] Starting clearance PDF generation for ID: ${pdfId}`);
    backendPerformanceMonitor.startStage('template-loading', pdfId);
    
    // Load images using our local function
    const { logoBase64 } = loadImages();
    
    // Use the proper template system - database-driven templates with placeholders
    console.log('[BROWSERLESS] Using database-driven template system');
    
    // Determine template type based on clearance type - FIXED: was using wrong variable name
    const dbTemplateType = data.clearanceType === 'Friable' ? 'asbestosClearanceFriable' : 'asbestosClearanceNonFriable';
    console.log(`[BROWSERLESS] Using template type: ${dbTemplateType}`);
    
    // Get template from database using the template service
    const template = await getTemplateByType(dbTemplateType);
    if (!template) {
      throw new Error(`Template not found for type: ${dbTemplateType}`);
    }
    
    console.log('[BROWSERLESS] Template loaded from database');
    
    // Use the same data structure as the working Puppeteer implementation
    const enrichedData = {
      ...data,
      clearanceItems: data.clearanceItems || data.items || []
    };
    
    console.log('[BROWSERLESS] Data enriched with clearance items');
    
    // Create complete HTML structure matching the working Puppeteer implementation
    const completeHTML = await generateCompleteClearanceHTML(template, enrichedData, logoBase64);
    
    backendPerformanceMonitor.endStage('template-loading', pdfId);
    backendPerformanceMonitor.startStage('html-generation', pdfId);
    
    // Generate PDF using Browserless instead of Puppeteer
    console.log('[BROWSERLESS DEBUG] Starting PDF generation with HTML length:', completeHTML.length);
    const pdfBuffer = await generatePDFWithBrowserless(completeHTML, pdfId);
    console.log('[BROWSERLESS DEBUG] PDF generation completed, buffer size:', pdfBuffer.length);
    
    // Clear user lookup cache
    clearUserLookupCache();
    
    const totalTime = Date.now() - backendPerformanceMonitor.stages[pdfId]['template-loading'].start;
    console.log(`[BROWSERLESS] Total clearance generation time: ${totalTime}ms`);
    
    return pdfBuffer;
    
  } catch (error) {
    console.error('[BROWSERLESS] Error generating clearance PDF:', error);
    throw error;
  }
};

// Helper function to generate complete HTML structure matching Puppeteer implementation
const generateCompleteClearanceHTML = async (template, data, logoBase64) => {
  try {
    console.log('[BROWSERLESS] Generating complete HTML structure using templates...');
    
    // Import the HTML_TEMPLATES and functions from the working Puppeteer implementation
    const { HTML_TEMPLATES, generateMainContentPages, generateSitePlanPage, generateAirMonitoringContent } = require('./pdf');
    
    // Get clearance items for photo pages
    const clearanceItems = data.clearanceItems || data.items || [];
    const itemsWithPhotos = clearanceItems.filter(item => 
      item.photograph && item.photograph.trim() !== ''
    );
    
    const photosPerPage = 2;
    const totalPhotoPages = Math.ceil(itemsWithPhotos.length / photosPerPage);
    console.log(`[BROWSERLESS] Need ${totalPhotoPages} photo pages for ${itemsWithPhotos.length} items with photos`);
    
    // Generate photo content for page 6
    const photoContent = itemsWithPhotos.slice(0, photosPerPage).map((item, index) => {
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
    
    // Populate all templates using the same logic as Puppeteer
    let pagesContent = '';
    
    // Page 1: Cover
    console.log('[BROWSERLESS] Generating page 1: Cover');
    const populatedCover = await populateTemplate(HTML_TEMPLATES.page1, data);
    pagesContent += `<div class="page-break">${populatedCover}</div>`;
    
    // Page 2: Version Control
    console.log('[BROWSERLESS] Generating page 2: Version Control');
    const populatedVersionControl = await populateTemplate(HTML_TEMPLATES.page2, data);
    pagesContent += `<div class="page-break">${populatedVersionControl}</div>`;
    
    // Page 3: Main Content (with overflow handling)
    console.log('[BROWSERLESS] Generating page 3: Main Content');
    const mainContentPages = await generateMainContentPages(data);
    mainContentPages.forEach((page, index) => {
      console.log(`[BROWSERLESS] Adding main content page ${index + 1} of ${mainContentPages.length}`);
      pagesContent += `<div class="page-break">${page}</div>`;
    });
    
    // Page 4: Background Information
    console.log('[BROWSERLESS] Generating page 4: Background Information');
    const populatedBackgroundTemplate = await populateTemplate(HTML_TEMPLATES.page3, data);
    pagesContent += `<div class="page-break">${populatedBackgroundTemplate}</div>`;
    
    // Page 5: Appendix A
    console.log('[BROWSERLESS] Generating page 5: Appendix A');
    const populatedAppendixA = await populateTemplate(HTML_TEMPLATES.page5, data);
    pagesContent += `<div class="page-break">${populatedAppendixA}</div>`;
    
    // Page 6: Photographs
    console.log('[BROWSERLESS] Generating page 6: Photographs');
    const populatedPhotoTemplate = HTML_TEMPLATES.page6.replace('[PHOTOGRAPHS_CONTENT]', photoContent);
    const populatedPhotos = await populateTemplate(populatedPhotoTemplate, data);
    pagesContent += `<div class="page-break">${populatedPhotos}</div>`;
    
    // Add extra photo pages if needed
    if (totalPhotoPages > 1) {
      for (let pageIndex = 1; pageIndex < totalPhotoPages; pageIndex++) {
        const startIndex = pageIndex * photosPerPage;
        const endIndex = Math.min(startIndex + photosPerPage, itemsWithPhotos.length);
        const pageItems = itemsWithPhotos.slice(startIndex, endIndex);
        
        const extraPhotoContent = pageItems.map((item, index) => {
          const photoNumber = startIndex + index + 1;
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
        
        const extraPhotoPageTemplate = HTML_TEMPLATES.page6.replace('[PHOTOGRAPHS_CONTENT]', extraPhotoContent);
        const populatedExtraPhotoPage = await populateTemplate(extraPhotoPageTemplate, data);
        pagesContent += `<div class="page-break">${populatedExtraPhotoPage}</div>`;
      }
    }
    
    // Page 7: Appendix B (Site Plan if present)
    const hasSitePlan = data.sitePlan && data.sitePlanFile;
    if (hasSitePlan) {
      console.log('[BROWSERLESS] Generating page 7: Appendix B (Site Plan)');
      const populatedSitePlanTemplate = await populateTemplate(HTML_TEMPLATES.page8, data, 'B');
      pagesContent += `<div class="page-break">${populatedSitePlanTemplate}</div>`;
      
      // Add the actual site plan content page
      const sitePlanPage = generateSitePlanPage(data, 'B', logoBase64);
      pagesContent += `<div class="page-break">${sitePlanPage}</div>`;
    } else {
      console.log('[BROWSERLESS] No site plan to add');
    }
    
    // Page 8: Air Monitoring (if present)
    const hasAirMonitoring = data.airMonitoring;
    if (hasAirMonitoring) {
      console.log('[BROWSERLESS] Generating page 8: Air Monitoring Report');
      const airMonitoringContent = generateAirMonitoringContent('B');
      const populatedAirMonitoring = HTML_TEMPLATES.page7.replace('[AIR_MONITORING_CONTENT]', airMonitoringContent);
      const populatedAirMonitoringPage = await populateTemplate(populatedAirMonitoring, data);
      pagesContent += `<div class="page-break">${populatedAirMonitoringPage}</div>`;
    } else {
      console.log('[BROWSERLESS] No air monitoring to add');
    }
    
    // Create complete HTML document
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asbestos Clearance Report</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:400,700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: "Montserrat", Arial, sans-serif;
      background: #fff;
    }
    .page-break {
      page-break-after: always;
    }
    .page-break:last-child {
      page-break-after: avoid;
    }
    .page-break > div {
      width: 800px;
      height: 1130px;
      margin: 40px auto;
      background: #fff;
      box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12);
      position: relative;
      padding: 0 0 0 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
  </style>
</head>
<body>
  ${pagesContent}
</body>
</html>`;
    
    console.log('[BROWSERLESS] Complete HTML structure generated with all pages');
    return htmlContent;
    
  } catch (error) {
    console.error('[BROWSERLESS] Error generating HTML structure:', error);
    throw error;
  }
};



// Route handlers
router.post('/generate-asbestos-clearance', async (req, res) => {
  const pdfId = `clearance-${req.body.clearanceData?._id || Date.now()}`;
  const startTime = Date.now();
  
  try {
    backendPerformanceMonitor.startTimer(`clearance-pdf-${pdfId}`);
    console.log('=== BROWSERLESS CLEARANCE PDF ROUTE HIT ===');
    console.log('Request headers:', req.headers);
    console.log('Request body keys:', Object.keys(req.body || {}));
    console.log('Request received for clearance ID: ' + req.body.clearanceData?._id);
    
    const { clearanceData } = req.body;
    
    if (!clearanceData) {
      console.log('ERROR: No clearance data provided');
      return res.status(400).json({ error: 'Clearance data is required' });
    }

    console.log('Clearance data received for: ' + (clearanceData.projectId?.name || 'Unknown project'));
    
    const clearanceItems = clearanceData.items || [];
    console.log('Clearance items found: ' + clearanceItems.length);
    
    backendPerformanceMonitor.startStage('data-preparation', pdfId);
    
    // Add clearance items to the data
    const enrichedData = {
      ...clearanceData,
      clearanceItems: clearanceItems
    };
    
    backendPerformanceMonitor.endStage('data-preparation', pdfId);
    backendPerformanceMonitor.startStage('pdf-generation', pdfId);
    
    console.log('Generating PDF with Browserless and clearance items...');
    
    // Generate PDF using Browserless
    const pdfBuffer = await generateClearancePDFWithBrowserless('asbestos-clearance', enrichedData);
    
    backendPerformanceMonitor.endStage('pdf-generation', pdfId);
    backendPerformanceMonitor.startStage('response-preparation', pdfId);
    
    console.log('PDF generated successfully, buffer size:', pdfBuffer.length);
    
    // Generate filename
    const fileName = `browserless-clearance-${clearanceData.projectId?.name || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
    
    console.log('Sending PDF response with filename:', fileName);
    
    // Set response headers with CORS support
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    
    backendPerformanceMonitor.endStage('response-preparation', pdfId);
    backendPerformanceMonitor.endTimer(`clearance-pdf-${pdfId}`);
    
    const totalTime = Date.now() - startTime;
    console.log(`Clearance PDF generation completed in ${totalTime}ms`);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating clearance PDF:', error);
    backendPerformanceMonitor.endTimer(`clearance-pdf-${pdfId}`);
    res.status(500).json({ 
      error: 'Failed to generate clearance PDF with Browserless', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/generate-asbestos-assessment', async (req, res) => {
  console.log('=== BROWSERLESS ASSESSMENT PDF ROUTE HIT ===');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    const { assessmentData } = req.body;
    
    if (!assessmentData) {
      return res.status(400).json({ error: 'Assessment data is required' });
    }
    
    console.log('Assessment data received:', {
      id: assessmentData._id,
      project: assessmentData.projectId?.name,
      assessor: assessmentData.assessorId?.firstName + ' ' + assessmentData.assessorId?.lastName,
      items: assessmentData.assessmentItems?.length || 0
    });
    
    const pdfBuffer = await generateAssessmentPDFWithBrowserless('asbestosAssessment', assessmentData);
    
    // Set response headers
    const fileName = `browserless-assessment-${assessmentData.projectId?.name || 'Unknown'}-${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    console.log('Sending Browserless PDF response, size:', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error in Browserless assessment PDF route:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate assessment PDF with Browserless', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint
router.get('/test-browserless', async (req, res) => {
  try {
    console.log('[BROWSERLESS TEST] Starting test...');
    
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 40px; 
            line-height: 1.6;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #16b12b;
            padding-bottom: 20px;
          }
          h1 { 
            color: #16b12b; 
            margin: 0;
          }
          .test-content {
            background: #f5f5f5;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Browserless Test Report</h1>
          <p>Testing HTML-to-PDF conversion with Browserless</p>
        </div>
        
        <div class="test-content">
          <h2>Test Information</h2>
          <p><strong>Service:</strong> Browserless.io</p>
          <p><strong>Test Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Purpose:</strong> Verify HTML-to-PDF conversion works with complex layouts</p>
        </div>
        
        <p>If you can see this PDF, Browserless is working correctly!</p>
      </body>
      </html>
    `;
    
    const pdfBuffer = await generatePDFWithBrowserless(testHTML, 'test');
    
    console.log('[BROWSERLESS TEST] Test successful, size:', pdfBuffer.length);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="browserless-test.pdf"');
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('[BROWSERLESS TEST] Error:', error);
    res.status(500).json({ 
      error: 'Browserless test failed', 
      message: error.message, 
      stack: error.stack
    });
  }
});

module.exports = router; 