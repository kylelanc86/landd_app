const express = require('express');
const router = express.Router();
const DocRaptorService = require('../services/docraptorService');
const fs = require('fs');
const path = require('path');

// Initialize DocRaptor service
const docRaptorService = new DocRaptorService();

// Simple health check to verify route is loaded
router.get('/health', (req, res) => {
  console.log('DocRaptor health check endpoint hit');
  res.json({ 
    status: 'ok', 
    service: 'DocRaptor',
    timestamp: new Date().toISOString(),
    apiKeyExists: !!process.env.DOCRAPTOR_API_KEY
  });
});

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
 * Generate complete HTML content for clearance report
 */
const generateClearanceHTML = async (clearanceData) => {
  try {
    // Load template files
    const templateDir = path.join(__dirname, '../templates/AsbestosClearance');
    
    // Determine template type (friable or non-friable)
    const isFriable = clearanceData.clearanceType === 'Friable';
    const templateSubDir = isFriable ? 'FriableClearance' : 'NonFriableClearance';
    const templatePath = path.join(templateDir, templateSubDir);
    
    // Load all template files with correct filenames
    const templates = {
      cover: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceCoverMockup-Page1-Friable.html' : 'AsbestosClearanceCoverMockup-Page1.html'), 'utf8'),
      versionControl: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceVersionControlMockup-page2-Friable.html' : 'AsbestosClearanceVersionControlMockup-page2.html'), 'utf8'),
      background: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceBackgroundMockup-page3-Friable.html' : 'AsbestosClearanceBackgroundMockup-page3.html'), 'utf8'),
      mainReport: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceMainReportMockup-page4-Friable.html' : 'AsbestosClearanceMainReportMockup-page4.html'), 'utf8'),
      appendixA: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceAppendixAMockuppage5-Friable.html' : 'AsbestosClearanceAppendixAMockuppage5.html'), 'utf8'),
      photographs: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearancePhotographsMockup-page6-Friable.html' : 'AsbestosClearancePhotographsMockup-page6.html'), 'utf8'),
      appendixB: fs.readFileSync(path.join(templatePath, isFriable ? 'AsbestosClearanceAppendixBMockup-page7-Friable.html' : 'AsbestosClearanceAppendixBMockup-page7.html'), 'utf8')
    };

    // Load logo and background images
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';
    
    const backgroundPath = path.join(__dirname, '../assets/clearance_front - Copy.jpg');
    const backgroundBase64 = fs.existsSync(backgroundPath) ? fs.readFileSync(backgroundPath).toString('base64') : '';

    // Create complete HTML document
    const completeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asbestos Clearance Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .page { page-break-after: always; padding: 0; margin: 0; }
          .page:last-child { page-break-after: avoid; }
          .logo { max-width: 200px; height: auto; }
          .cover-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
          .cover-content { position: relative; z-index: 1; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <!-- Page 1: Cover -->
        <div class="page">
          ${templates.cover.replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)}
        </div>
        
        <!-- Page 2: Version Control -->
        <div class="page">
          ${templates.versionControl}
        </div>
        
        <!-- Page 3: Background -->
        <div class="page">
          ${templates.background}
        </div>
        
        <!-- Page 4: Main Report -->
        <div class="page">
          ${templates.mainReport}
        </div>
        
        <!-- Page 5: Appendix A -->
        <div class="page">
          ${templates.appendixA}
        </div>
        
        <!-- Page 6: Photographs -->
        <div class="page">
          ${templates.photographs}
        </div>
        
        <!-- Page 7: Appendix B -->
        <div class="page">
          ${templates.appendixB}
        </div>
      </body>
      </html>
    `;

    return completeHTML;
  } catch (error) {
    console.error('Error generating clearance HTML:', error);
    throw new Error(`Failed to generate clearance HTML: ${error.message}`);
  }
};

/**
 * Generate complete HTML content for assessment report
 */
const generateAssessmentHTML = async (assessmentData) => {
  try {
    // Load template files
    const templateDir = path.join(__dirname, '../templates/AsbestosAssessment');
    
    // Load all template files
    const templates = {
      cover: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentCoverMockup-Page1.html'), 'utf8'),
      versionControl: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentVersionControlMockup-page2.html'), 'utf8'),
      sampleRegister: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentReportPage3.html'), 'utf8'),
      discussion: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentDiscussionConclusions.html'), 'utf8'),
      sampleItem: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentSampleRegisterItem.html'), 'utf8'),
      glossary: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentGlossary.html'), 'utf8'),
      appendixA: fs.readFileSync(path.join(templateDir, 'AsbestosAssessmentAppendixA.html'), 'utf8')
    };

    // Load logo
    const logoPath = path.join(__dirname, '../assets/logo.png');
    const logoBase64 = fs.existsSync(logoPath) ? fs.readFileSync(logoPath).toString('base64') : '';

    // Create complete HTML document
    const completeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asbestos Assessment Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
          .page { page-break-after: always; padding: 0; margin: 0; }
          .page:last-child { page-break-after: avoid; }
          .logo { max-width: 200px; height: auto; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <!-- Page 1: Cover -->
        <div class="page">
          ${templates.cover.replace(/\[LOGO_PATH\]/g, `data:image/png;base64,${logoBase64}`)}
        </div>
        
        <!-- Page 2: Version Control -->
        <div class="page">
          ${templates.versionControl}
        </div>
        
        <!-- Page 3: Sample Register -->
        <div class="page">
          ${templates.sampleRegister}
        </div>
        
        <!-- Page 4: Discussion -->
        <div class="page">
          ${templates.discussion}
        </div>
        
        <!-- Page 5: Glossary -->
        <div class="page">
          ${templates.glossary}
        </div>
        
        <!-- Page 6: Appendix A -->
        <div class="page">
          ${templates.appendixA}
        </div>
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
 * Generate Asbestos Clearance Report using DocRaptor
 */
router.post('/generate-asbestos-clearance', async (req, res) => {
  const pdfId = `clearance-${Date.now()}`;
  console.log(`[${pdfId}] === CLEARANCE REQUEST RECEIVED ===`);
  console.log(`[${pdfId}] Request headers:`, req.headers);
  console.log(`[${pdfId}] Request body keys:`, Object.keys(req.body || {}));
  backendPerformanceMonitor.startStage('request-received', pdfId);
  
  try {
    const { clearanceData } = req.body;
    
    if (!clearanceData) {
      return res.status(400).json({ error: 'Clearance data is required' });
    }

    console.log(`[${pdfId}] Generating clearance PDF for data:`, clearanceData);
    backendPerformanceMonitor.startStage('data-validation', pdfId);

    // Validate clearance data
    if (!clearanceData._id && !clearanceData.projectId) {
      return res.status(400).json({ error: 'Invalid clearance data' });
    }

    backendPerformanceMonitor.endStage('data-validation', pdfId);
    backendPerformanceMonitor.startStage('template-population', pdfId);

    // Generate HTML content
    console.log(`[${pdfId}] Generating clearance HTML...`);
    const htmlContent = await generateClearanceHTML(clearanceData);
    
    console.log(`[${pdfId}] HTML content generated, size: ${htmlContent.length} characters`);
    console.log(`[${pdfId}] HTML preview (first 500 chars):`, htmlContent.substring(0, 500));

    backendPerformanceMonitor.endStage('template-population', pdfId);
    backendPerformanceMonitor.startStage('docraptor-generation', pdfId);

    // Generate filename
    const projectId = clearanceData.projectId?.projectID || clearanceData.project?.projectID || clearanceData.projectId || 'Unknown';
    const siteName = clearanceData.projectId?.name || clearanceData.project?.name || clearanceData.siteName || 'Unknown';
    const clearanceDate = clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
    const clearanceType = clearanceData.clearanceType || 'Non-friable';
    const filename = `${projectId}_${clearanceType}_Clearance_${siteName}_${clearanceDate}.pdf`;

    console.log(`[${pdfId}] Generating PDF with DocRaptor...`);
    
    // Generate PDF using DocRaptor
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent);

    backendPerformanceMonitor.endStage('docraptor-generation', pdfId);
    backendPerformanceMonitor.startStage('response-sending', pdfId);

    console.log(`[${pdfId}] PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);

    backendPerformanceMonitor.endStage('response-sending', pdfId);
    console.log(`[${pdfId}] Clearance PDF generation completed successfully`);

  } catch (error) {
    console.error(`[${pdfId}] Error generating clearance PDF:`, error);
    res.status(500).json({ 
      error: 'Failed to generate clearance PDF',
      details: error.message 
    });
  }
});

/**
 * Generate Asbestos Assessment Report using DocRaptor
 */
router.post('/generate-asbestos-assessment', async (req, res) => {
  const pdfId = `assessment-${Date.now()}`;
  console.log(`[${pdfId}] === ASSESSMENT REQUEST RECEIVED ===`);
  console.log(`[${pdfId}] Request headers:`, req.headers);
  console.log(`[${pdfId}] Request body keys:`, Object.keys(req.body || {}));
  backendPerformanceMonitor.startStage('request-received', pdfId);
  
  try {
    const { assessmentData } = req.body;
    
    if (!assessmentData) {
      return res.status(400).json({ error: 'Assessment data is required' });
    }

    console.log(`[${pdfId}] Generating assessment PDF for data:`, assessmentData);
    backendPerformanceMonitor.startStage('data-validation', pdfId);

    // Validate assessment data
    if (!assessmentData._id && !assessmentData.projectId) {
      return res.status(400).json({ error: 'Invalid assessment data' });
    }

    backendPerformanceMonitor.endStage('data-validation', pdfId);
    backendPerformanceMonitor.startStage('template-population', pdfId);

    // Generate HTML content
    console.log(`[${pdfId}] Generating assessment HTML...`);
    const htmlContent = await generateAssessmentHTML(assessmentData);
    
    console.log(`[${pdfId}] HTML content generated, size: ${htmlContent.length} characters`);
    console.log(`[${pdfId}] HTML preview (first 500 chars):`, htmlContent.substring(0, 500));

    backendPerformanceMonitor.endStage('template-population', pdfId);
    backendPerformanceMonitor.startStage('docraptor-generation', pdfId);

    // Generate filename
    const projectId = assessmentData.projectId?.projectID || assessmentData.jobReference || 'Unknown';
    const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown';
    const assessmentDate = assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
    const filename = `${projectId}_Asbestos_Assessment_${siteName}_${assessmentDate}.pdf`;

    console.log(`[${pdfId}] Generating PDF with DocRaptor...`);
    
    // Generate PDF using DocRaptor
    const pdfBuffer = await docRaptorService.generatePDF(htmlContent);

    backendPerformanceMonitor.endStage('docraptor-generation', pdfId);
    backendPerformanceMonitor.startStage('response-sending', pdfId);

    console.log(`[${pdfId}] PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);

    backendPerformanceMonitor.endStage('response-sending', pdfId);
    console.log(`[${pdfId}] Assessment PDF generation completed successfully`);

  } catch (error) {
    console.error(`[${pdfId}] Error generating assessment PDF:`, error);
    res.status(500).json({ 
      error: 'Failed to generate assessment PDF',
      details: error.message 
    });
  }
});

/**
 * Test DocRaptor connection
 */
router.get('/test', async (req, res) => {
  try {
    console.log('Testing DocRaptor connection...');
    const isConnected = await docRaptorService.testConnection();
    
    if (isConnected) {
      res.json({ 
        success: true, 
        message: 'DocRaptor connection successful',
        service: 'DocRaptor'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'DocRaptor connection failed',
        service: 'DocRaptor'
      });
    }
  } catch (error) {
    console.error('DocRaptor test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'DocRaptor test failed',
      details: error.message,
      service: 'DocRaptor'
    });
  }
});

/**
 * Test DocRaptor with simple HTML
 */
router.post('/test-simple', async (req, res) => {
  try {
    console.log('Testing DocRaptor with simple HTML...');
    
    const simpleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Simple Test</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: blue; }
        </style>
      </head>
      <body>
        <h1>DocRaptor Test</h1>
        <p>This is a simple test PDF generated at ${new Date().toISOString()}</p>
        <p>If you can see this, DocRaptor is working!</p>
      </body>
      </html>
    `;
    
    const pdfBuffer = await docRaptorService.generatePDF(simpleHTML);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-simple.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Simple test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Simple test failed',
      details: error.message
    });
  }
});

module.exports = router; 