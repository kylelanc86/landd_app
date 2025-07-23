const express = require('express');
const router = express.Router();
const PDFShiftService = require('../services/pdfshiftService');
const fs = require('fs');
const path = require('path');

// Initialize PDFShift service
const pdfShiftService = new PDFShiftService();

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
    
    // Load all template files
    const templates = {
      cover: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceCoverMockup-page1.html'), 'utf8'),
      versionControl: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceVersionControlMockup-page2.html'), 'utf8'),
      inspectionDetails: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceBackgroundMockup-page3.html'), 'utf8'),
      background: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceBackgroundMockup-page3.html'), 'utf8'),
      appendixA: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceAppendixAMockuppage5.html'), 'utf8'),
      photographs: fs.readFileSync(path.join(templatePath, 'AsbestosClearancePhotographsMockup-page6.html'), 'utf8'),
      appendixB: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceAppendixBMockup-page7.html'), 'utf8'),
      airMonitoring: fs.readFileSync(path.join(templatePath, 'AsbestosClearanceAirMonitoringMockup-page8.html'), 'utf8')
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
          .page { page-break-after: always; padding: 20px; }
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
        
        <!-- Page 3: Inspection Details -->
        <div class="page">
          ${templates.inspectionDetails}
        </div>
        
        <!-- Page 4: Background -->
        <div class="page">
          ${templates.background}
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
        
        <!-- Page 8: Air Monitoring -->
        <div class="page">
          ${templates.airMonitoring}
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
          .page { page-break-after: always; padding: 20px; }
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
 * Generate Asbestos Clearance Report using PDFShift
 */
router.post('/generate-asbestos-clearance', async (req, res) => {
  const pdfId = `clearance-${Date.now()}`;
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

    backendPerformanceMonitor.endStage('template-population', pdfId);
    backendPerformanceMonitor.startStage('pdfshift-generation', pdfId);

    // Generate filename
    const projectId = clearanceData.projectId?.projectID || clearanceData.project?.projectID || clearanceData.projectId || 'Unknown';
    const siteName = clearanceData.projectId?.name || clearanceData.project?.name || clearanceData.siteName || 'Unknown';
    const clearanceDate = clearanceData.clearanceDate ? new Date(clearanceData.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
    const clearanceType = clearanceData.clearanceType || 'Non-friable';
    const filename = `${projectId}_${clearanceType}_Clearance_${siteName}_${clearanceDate}.pdf`;

    console.log(`[${pdfId}] Generating PDF with PDFShift...`);
    
    // Generate PDF using PDFShift
    const pdfBuffer = await pdfShiftService.generatePDF(htmlContent);

    backendPerformanceMonitor.endStage('pdfshift-generation', pdfId);
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
 * Generate Asbestos Assessment Report using PDFShift
 */
router.post('/generate-asbestos-assessment', async (req, res) => {
  const pdfId = `assessment-${Date.now()}`;
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

    backendPerformanceMonitor.endStage('template-population', pdfId);
    backendPerformanceMonitor.startStage('pdfshift-generation', pdfId);

    // Generate filename
    const projectId = assessmentData.projectId?.projectID || assessmentData.jobReference || 'Unknown';
    const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown';
    const assessmentDate = assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
    const filename = `${projectId}_Asbestos_Assessment_${siteName}_${assessmentDate}.pdf`;

    console.log(`[${pdfId}] Generating PDF with PDFShift...`);
    
    // Generate PDF using PDFShift
    const pdfBuffer = await pdfShiftService.generatePDF(htmlContent);

    backendPerformanceMonitor.endStage('pdfshift-generation', pdfId);
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
 * Test PDFShift connection
 */
router.get('/test', async (req, res) => {
  try {
    console.log('Testing PDFShift connection...');
    const isConnected = await pdfShiftService.testConnection();
    
    if (isConnected) {
      res.json({ 
        success: true, 
        message: 'PDFShift connection successful',
        service: 'PDFShift'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'PDFShift connection failed',
        service: 'PDFShift'
      });
    }
  } catch (error) {
    console.error('PDFShift test error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'PDFShift test failed',
      details: error.message,
      service: 'PDFShift'
    });
  }
});

module.exports = router; 