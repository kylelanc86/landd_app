const express = require('express');
const router = express.Router();
const PDFShiftService = require('../services/pdfshiftService');
const { populateTemplate, populateAssessmentTemplate } = require('./pdf');

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

    // Generate HTML content using existing template functions
    console.log(`[${pdfId}] Populating clearance template...`);
    
    // Use the existing populateTemplate function from pdf.js
    const htmlContent = await populateTemplate(
      null, // We'll generate the full HTML here
      clearanceData,
      'B', // appendix letter
      null, // logo base64
      null  // background base64
    );

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

    // Generate HTML content using existing template functions
    console.log(`[${pdfId}] Populating assessment template...`);
    
    // Use the existing populateAssessmentTemplate function from pdf.js
    const htmlContent = await populateAssessmentTemplate(
      null, // We'll generate the full HTML here
      assessmentData,
      null, // logo base64
      null  // background base64
    );

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