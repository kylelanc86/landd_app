import pdfPerformanceMonitor from "./pdfPerformanceMonitor";

/**
 * Generate PDF from HTML templates using server-side Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @returns {Promise<string>} - Generated PDF filename
 */
export const generateHTMLPDF = async (templateType, data) => {
  return generateHTMLTemplatePDF(templateType, data);
};

export const generateAssessmentPDF = async (assessmentData) => {
  const pdfId = `assessment-${assessmentData._id || Date.now()}`;
  const generationId = pdfPerformanceMonitor.trackCommonStages(pdfId, 'asbestos-assessment', assessmentData);
  
  try {
    console.log('Starting assessment PDF generation with data:', assessmentData);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    
    pdfPerformanceMonitor.endStage('data-preparation', generationId);
    pdfPerformanceMonitor.startStage('api-request', generationId);
    
    // Use the same API configuration as the rest of the app
    const apiBaseUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api");
    
    const requestUrl = `${apiBaseUrl}/pdf/generate-asbestos-assessment?t=${Date.now()}`;
    console.log('Calling backend URL:', requestUrl);

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      // Call the server-side PDF generation endpoint with cache busting and timeout
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ assessmentData: assessmentData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      pdfPerformanceMonitor.endStage('api-request', generationId);
      pdfPerformanceMonitor.startStage('response-processing', generationId);

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Failed to generate assessment PDF' };
        }
        throw new Error(errorData.error || 'Failed to generate assessment PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      console.log('Assessment PDF blob size:', pdfBlob.size, 'bytes');

      pdfPerformanceMonitor.endStage('response-processing', generationId);
      pdfPerformanceMonitor.startStage('download-preparation', generationId);

      // Create a download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const projectId = assessmentData.projectId?.projectID || assessmentData.jobReference || 'Unknown';
      const siteName = assessmentData.projectId?.name || assessmentData.siteName || 'Unknown';
      const assessmentDate = assessmentData.assessmentDate ? new Date(assessmentData.assessmentDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
      const fileName = `${projectId}: Asbestos Assessment Report - ${siteName} (${assessmentDate}).pdf`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      pdfPerformanceMonitor.endStage('download-preparation', generationId);
      pdfPerformanceMonitor.endPDFGeneration(generationId);

      return fileName;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Assessment PDF generation timed out after 30 seconds');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    pdfPerformanceMonitor.endPDFGeneration(generationId);
    throw error;
  }
};

/**
 * Generate PDF from HTML templates using server-side Browserless
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @returns {Promise<string>} - Generated PDF filename
 */
export const generateHTMLTemplatePDF = async (templateType, data) => {
  const pdfId = `clearance-${data._id || Date.now()}`;
  const generationId = pdfPerformanceMonitor.trackCommonStages(pdfId, 'asbestos-clearance', data);
  
  try {
    console.log('Starting clearance PDF generation with data:', data);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    
    pdfPerformanceMonitor.endStage('data-preparation', generationId);
    pdfPerformanceMonitor.startStage('api-request', generationId);
    
    // Use the same API configuration as the rest of the app
    const apiBaseUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api");
    
    const requestUrl = `${apiBaseUrl}/pdf-browserless/generate-asbestos-clearance?t=${Date.now()}`;
    console.log('Calling backend URL:', requestUrl);

    // Create an AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      // Call the server-side PDF generation endpoint with cache busting and timeout
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        body: JSON.stringify({ clearanceData: data }),
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      pdfPerformanceMonitor.endStage('api-request', generationId);
      pdfPerformanceMonitor.startStage('response-processing', generationId);

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { error: errorText || 'Failed to generate clearance PDF' };
        }
        throw new Error(errorData.error || 'Failed to generate clearance PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      console.log('Clearance PDF blob size:', pdfBlob.size, 'bytes');

      pdfPerformanceMonitor.endStage('response-processing', generationId);
      pdfPerformanceMonitor.startStage('download-preparation', generationId);

      // Create a download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const projectId = data.projectId?.projectID || data.project?.projectID || data.projectId || 'Unknown';
      const siteName = data.projectId?.name || data.project?.name || data.siteName || 'Unknown';
      const clearanceDate = data.clearanceDate ? new Date(data.clearanceDate).toLocaleDateString('en-GB').replace(/\//g, '-') : 'Unknown';
      const clearanceType = data.clearanceType || 'Non-friable';
      const fileName = `${projectId}: ${clearanceType} Asbestos Clearance Report - ${siteName} (${clearanceDate}).pdf`;
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      pdfPerformanceMonitor.endStage('download-preparation', generationId);
      pdfPerformanceMonitor.endPDFGeneration(generationId);

      return fileName;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Clearance PDF generation timed out after 60 seconds');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error generating clearance PDF:', error);
    pdfPerformanceMonitor.endPDFGeneration(generationId);
    throw error;
  }
}; 