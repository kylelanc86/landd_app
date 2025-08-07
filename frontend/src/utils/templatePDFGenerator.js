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
  
  try {
    console.log('Starting assessment PDF generation with data:', assessmentData);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    
    // Use the same API configuration as the rest of the app
    const apiBaseUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? "http://localhost:5000/api" : "https://landd-app-backend-docker.onrender.com/api");
    
    const requestUrl = `${apiBaseUrl}/pdf-docraptor-v2/generate-asbestos-assessment?t=${Date.now()}`;
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
    throw error;
  }
};

/**
 * Generate PDF from HTML templates using server-side Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @returns {Promise<string>} - Generated PDF filename
 */
export const generateHTMLTemplatePDF = async (type, data, options = {}) => {
  try {
    console.log(`Starting ${type} PDF generation with data:`, data);
    console.log('Environment:', process.env.NODE_ENV);
    console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
    
    // Determine which endpoint to use
    const useDocRaptor = true; // Use DocRaptor for better complex document support
    
    let endpoint;
    if (useDocRaptor) {
      if (type === 'asbestos-clearance') {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-clearance-v2';  // Use V2 endpoint
      } else if (type === 'asbestos-assessment') {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-assessment';  // Updated to use V2 endpoint
      } else if (type === 'client-supplied-fibre-id') {
        endpoint = '/pdf-docraptor-v2/generate-client-supplied-fibre-id';
      } else {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-assessment'; // Default fallback
      }
    } else {
      if (type === 'asbestos-clearance') {
        endpoint = '/pdf/generate-asbestos-clearance';
      } else if (type === 'asbestos-assessment') {
        endpoint = '/pdf/generate-asbestos-assessment';
      } else if (type === 'client-supplied-fibre-id') {
        endpoint = '/pdf-docraptor-v2/generate-client-supplied-fibre-id'; // Always use DocRaptor for fibre ID
      } else {
        endpoint = '/pdf/generate-asbestos-assessment'; // Default fallback
      }
    }
    
    const url = `${process.env.REACT_APP_API_URL}${endpoint}?t=${Date.now()}`;
    console.log('Calling backend URL:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        clearanceData: type === 'asbestos-clearance' ? data : undefined,
        assessmentData: type === 'asbestos-assessment' ? data : undefined,
        jobData: type === 'client-supplied-fibre-id' ? data : undefined,
      }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Response error text:', errorText);
      throw new Error(`Failed to generate ${type} PDF`);
    }

    const pdfBlob = await response.blob();

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${type}_${timestamp}.pdf`;

    // Create download link
    const url2 = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url2;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url2);

    return { success: true, filename };

  } catch (error) {
    console.error(`Error generating ${type} PDF:`, error);
    throw error;
  }
};