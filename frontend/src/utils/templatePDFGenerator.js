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
    
    const requestUrl = `${apiBaseUrl}/pdf-docraptor-v2/generate-asbestos-assessment-v3?t=${Date.now()}`;
    console.log('Calling backend URL:', requestUrl);

    // Create an AbortController for timeout handling
    const PDF_REQUEST_TIMEOUT_MS = 130000; // 130s for upload + DocRaptor + download
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDF_REQUEST_TIMEOUT_MS);

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
        throw new Error(`Assessment PDF generation timed out after ${PDF_REQUEST_TIMEOUT_MS / 1000} seconds. Try again or use a faster connection.`);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error generating assessment PDF:', error);
    throw error;
  }
};

const API_BASE = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '');

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
});

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes (DocRaptor async limit)

/**
 * Start async clearance PDF generation. Returns jobId for polling.
 * @param {Object} clearanceData - Full clearance data (e.g. from getById)
 * @returns {Promise<{ jobId: string }>}
 */
export async function startClearancePDFJob(clearanceData) {
  const startUrl = `${API_BASE}/pdf-docraptor-v2/generate-asbestos-clearance-v2`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ clearanceData }),
  });
  if (!startRes.ok) {
    const errText = await startRes.text();
    let errMsg = `Failed to start PDF: ${startRes.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.error || j.details) errMsg = j.details || j.error;
    } catch (_) {}
    throw new Error(errMsg);
  }
  const data = await startRes.json();
  if (!data.jobId) throw new Error('Server did not return a job ID');
  return { jobId: data.jobId };
}

/**
 * Get status of an async clearance PDF job (for polling).
 * @param {string} jobId - From startClearancePDFJob
 * @returns {Promise<{ status: string, message?: string, error?: string, ready?: boolean }>}
 */
export async function getClearancePDFStatus(jobId) {
  const statusUrl = `${API_BASE}/pdf-docraptor-v2/status/${jobId}`;
  const res = await fetch(statusUrl, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

/**
 * Download a completed clearance PDF by jobId (call when status is 'completed').
 * Triggers browser download; returns filename from Content-Disposition.
 * @param {string} jobId - From startClearancePDFJob, after status is completed
 * @param {Object} options - { openInNewTab?: boolean }
 * @returns {Promise<{ filename: string }>}
 */
export async function downloadClearancePDFByJobId(jobId, options = {}) {
  const { openInNewTab = false } = options;
  const downloadUrl = `${API_BASE}/pdf-docraptor-v2/download/${jobId}`;
  const res = await fetch(downloadUrl, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Download failed: ${res.status} - ${errText}`);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = `clearance_${new Date().toISOString().slice(0, 10)}.pdf`;
  if (contentDisposition) {
    const m = contentDisposition.match(/filename="(.+)"/);
    if (m) filename = m[1];
  }
  const blobUrl = window.URL.createObjectURL(blob);
  try {
    if (openInNewTab) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    window.URL.revokeObjectURL(blobUrl);
    throw e;
  }
  return { filename };
}

/**
 * Download a clearance PDF by clearance ID (uses persisted PDF; no regeneration).
 * Call when clearance.pdfDownloadUrl is set (PDF was already generated).
 * @param {string} clearanceId - Clearance _id
 * @param {Object} options - { openInNewTab?: boolean }
 * @returns {Promise<{ filename: string }>}
 */
export async function downloadClearancePDFByClearanceId(clearanceId, options = {}) {
  const { openInNewTab = false } = options;
  const url = `${API_BASE}/pdf-docraptor-v2/download-by-clearance/${clearanceId}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(res.status === 404 ? 'No PDF available. Generate the PDF first.' : `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = `clearance_${clearanceId}.pdf`;
  if (contentDisposition) {
    const m = contentDisposition.match(/filename="(.+)"/);
    if (m) filename = m[1];
  }
  const blobUrl = window.URL.createObjectURL(blob);
  try {
    if (openInNewTab) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    window.URL.revokeObjectURL(blobUrl);
    throw e;
  }
  return { filename };
}

/**
 * Start async lead clearance PDF generation. Returns jobId for polling (use getClearancePDFStatus).
 * @param {Object} leadClearanceData - Full clearance data (e.g. from getById)
 * @returns {Promise<{ jobId: string }>}
 */
export async function startLeadClearancePDFJob(leadClearanceData) {
  const startUrl = `${API_BASE}/pdf-docraptor-v2/generate-lead-clearance-v2`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ leadClearanceData }),
  });
  if (!startRes.ok) {
    const errText = await startRes.text();
    let errMsg = `Failed to start PDF: ${startRes.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.error || j.details) errMsg = j.details || j.error;
    } catch (_) {}
    throw new Error(errMsg);
  }
  const data = await startRes.json();
  if (!data.jobId) throw new Error('Server did not return a job ID');
  return { jobId: data.jobId };
}

/**
 * Download lead clearance PDF by clearance ID (uses persisted PDF; no regeneration).
 * @param {string} clearanceId - Lead clearance _id
 * @param {Object} options - { openInNewTab?: boolean }
 * @returns {Promise<{ filename: string }>}
 */
export async function downloadLeadClearancePDFByClearanceId(clearanceId, options = {}) {
  const { openInNewTab = false } = options;
  const url = `${API_BASE}/pdf-docraptor-v2/download-by-lead-clearance/${clearanceId}`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(res.status === 404 ? 'No PDF available. Generate the PDF first.' : `Download failed: ${res.status}`);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = `lead_clearance_${clearanceId}.pdf`;
  if (contentDisposition) {
    const m = contentDisposition.match(/filename="(.+)"/);
    if (m) filename = m[1];
  }
  const blobUrl = window.URL.createObjectURL(blob);
  try {
    if (openInNewTab) {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (e) {
    window.URL.revokeObjectURL(blobUrl);
    throw e;
  }
  return { filename };
}

/**
 * Start async assessment PDF generation. Returns jobId for polling.
 * Sends only assessmentId + isResidential so the backend loads the assessment from DB (avoids large body).
 * @param {string|Object} assessmentIdOrData - Assessment ID string, or full assessment object (id used only)
 * @param {{ isResidential?: boolean }} options
 * @returns {Promise<{ jobId: string }>}
 */
export async function startAssessmentPDFJob(assessmentIdOrData, options = {}) {
  const assessmentId = typeof assessmentIdOrData === 'object' && assessmentIdOrData != null
    ? (assessmentIdOrData._id || assessmentIdOrData.id)
    : assessmentIdOrData;
  const payload = {
    assessmentId: assessmentId != null ? String(assessmentId) : undefined,
    ...(options.isResidential === true && { isResidential: true }),
  };
  const res = await fetch(`${API_BASE}/pdf-docraptor-v2/start-asbestos-assessment-pdf`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `Failed to start assessment PDF: ${res.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.error || j.details) errMsg = j.details || j.error;
    } catch (_) {}
    throw new Error(errMsg);
  }
  const data = await res.json();
  if (!data.jobId) throw new Error('Server did not return a job ID');
  return { jobId: data.jobId };
}

/**
 * Get status of an async assessment PDF job (same endpoint as clearance).
 * @param {string} jobId - From startAssessmentPDFJob
 * @returns {Promise<{ status: string, ready?: boolean, message?: string, error?: string }>}
 */
export async function getAssessmentPDFStatus(jobId) {
  const res = await fetch(`${API_BASE}/pdf-docraptor-v2/status/${jobId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

/**
 * Download assessment PDF by assessment ID (uses persisted PDF; no regeneration).
 * @param {string} assessmentId - Assessment _id
 * @returns {Promise<{ filename: string }>}
 */
export async function downloadAssessmentPDFByAssessmentId(assessmentId) {
  const res = await fetch(`${API_BASE}/pdf-docraptor-v2/download-by-assessment/${assessmentId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text();
    let message = `Download failed: ${res.status}`;
    try {
      const data = JSON.parse(errText);
      if (res.status === 410 && data.hint) {
        message = data.hint;
      } else if ((res.status === 404 || res.status === 410) && (data.hint || data.error)) {
        message = data.hint || data.error;
      }
    } catch {
      if (res.status === 404) message = 'No PDF available. Generate the PDF first.';
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = `assessment_${assessmentId}.pdf`;
  if (contentDisposition) {
    const m = contentDisposition.match(/filename="(.+)"/);
    if (m) filename = m[1];
  }
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  return { filename };
}

/**
 * Async clearance flow: start job, poll status, then download when ready.
 * @param {Object} data - Clearance data
 * @param {Object} options - { openInNewTab, onStatus?: (payload) => void }
 * @returns {Promise<{ success: true, filename: string }>}
 */
async function generateClearancePDFAsync(data, options = {}) {
  const { openInNewTab = false, onStatus } = options;
  const startUrl = `${API_BASE}/pdf-docraptor-v2/generate-asbestos-clearance-v2`;
  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ clearanceData: data }),
  });
  if (!startRes.ok) {
    const errText = await startRes.text();
    let errMsg = `Failed to start PDF: ${startRes.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.error || j.details) errMsg = j.details || j.error;
    } catch (_) {}
    throw new Error(errMsg);
  }
  const { jobId } = await startRes.json();
  if (!jobId) throw new Error('Server did not return a job ID');

  const statusUrl = `${API_BASE}/pdf-docraptor-v2/status/${jobId}`;
  const downloadUrl = `${API_BASE}/pdf-docraptor-v2/download/${jobId}`;
  const startedAt = Date.now();

  const reportStatus = (payload) => {
    if (typeof onStatus === 'function') onStatus(payload);
  };

  reportStatus({ status: 'queued', message: 'Preparing PDF…' });
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('PDF generation timed out. Please try again.');
    }
    const statusRes = await fetch(statusUrl, { headers: getAuthHeaders() });
    if (!statusRes.ok) {
      throw new Error(`Status check failed: ${statusRes.status}`);
    }
    const statusData = await statusRes.json();
    const { status, error: statusError, message } = statusData;

    if (status === 'queued') {
      reportStatus({ status: 'queued', message: message || 'Preparing PDF…' });
    } else if (status === 'working') {
      reportStatus({ status: 'working', message: message || 'Generating PDF…' });
    } else if (status === 'completed' || statusData.ready) {
      reportStatus({ status: 'completed', message: 'PDF ready' });
      const downloadRes = await fetch(downloadUrl, { headers: getAuthHeaders() });
      if (!downloadRes.ok) {
        const errText = await downloadRes.text();
        throw new Error(`Download failed: ${downloadRes.status} - ${errText}`);
      }
      const pdfBlob = await downloadRes.blob();
      const contentDisposition = downloadRes.headers.get('Content-Disposition');
      let filename = `clearance_${new Date().toISOString().slice(0, 10)}.pdf`;
      if (contentDisposition) {
        const m = contentDisposition.match(/filename="(.+)"/);
        if (m) filename = m[1];
      }
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      try {
        if (openInNewTab) {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      } catch (e) {
        window.URL.revokeObjectURL(blobUrl);
        throw e;
      }
      return { success: true, filename };
    } else if (status === 'failed') {
      const errMsg = statusError || message || 'PDF generation failed';
      reportStatus({ status: 'failed', error: errMsg });
      throw new Error(errMsg);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

/**
 * Generate PDF from HTML templates using server-side Puppeteer
 * @param {string} templateType - Type of template (e.g., 'asbestos-clearance')
 * @param {Object} data - Clearance data
 * @param {Object} options - Options: openInNewTab (default: false), onStatus?: (payload) => void for async status updates
 * @returns {Promise<{ success: boolean, filename?: string }>} - Generated PDF filename / result
 */
// DocRaptor sync limit is 60s; allow 120s for upload + generation + download on slow connections
const PDF_REQUEST_TIMEOUT_MS = 120000;

export const generateHTMLTemplatePDF = async (type, data, options = {}) => {
  const { openInNewTab = false, onStatus } = options;
  try {
    const useDocRaptor = true;

    // Asbestos clearance uses async DocRaptor flow (start job → poll status → download)
    if (useDocRaptor && type === 'asbestos-clearance') {
      return await generateClearancePDFAsync(data, { openInNewTab, onStatus });
    }

    // Lead clearance uses same async flow: start job → poll → download by clearance id
    if (useDocRaptor && type === 'lead-clearance') {
      const { jobId } = await startLeadClearancePDFJob(data);
      const statusUrl = `${API_BASE}/pdf-docraptor-v2/status/${jobId}`;
      const startedAt = Date.now();
      const reportStatus = (payload) => { if (typeof onStatus === 'function') onStatus(payload); };
      reportStatus({ status: 'queued', message: 'Preparing PDF…' });
      while (true) {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          throw new Error('PDF generation timed out. Please try again.');
        }
        const statusRes = await fetch(statusUrl, { headers: getAuthHeaders() });
        if (!statusRes.ok) throw new Error(`Status check failed: ${statusRes.status}`);
        const statusData = await statusRes.json();
        if (statusData.status === 'queued') reportStatus({ status: 'queued', message: statusData.message || 'Preparing PDF…' });
        else if (statusData.status === 'working') reportStatus({ status: 'working', message: statusData.message || 'Generating PDF…' });
        else if (statusData.status === 'completed' || statusData.ready) {
          reportStatus({ status: 'completed', message: 'PDF ready' });
          const clearanceId = data._id || data.id;
          if (!clearanceId) throw new Error('Clearance ID required to download');
          const { filename } = await downloadLeadClearancePDFByClearanceId(clearanceId, { openInNewTab });
          return { success: true, filename };
        } else if (statusData.status === 'failed') {
          const errMsg = statusData.error || statusData.message || 'PDF generation failed';
          reportStatus({ status: 'failed', error: errMsg });
          throw new Error(errMsg);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    // All other types: synchronous request (existing behaviour)
    let endpoint;
    if (useDocRaptor) {
      if (type === 'asbestos-clearance') {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-clearance-v2';  // Use V2 endpoint
      } else if (type === 'lead-clearance') {
        endpoint = '/pdf-docraptor-v2/generate-lead-clearance-v2';
      } else if (type === 'asbestos-assessment') {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-assessment-v3';  // Use experimental flow-based endpoint
      } else if (type === 'client-supplied-fibre-id') {
        endpoint = '/pdf-docraptor-v2/generate-client-supplied-fibre-id';
      } else {
        endpoint = '/pdf-docraptor-v2/generate-asbestos-assessment-v3';
      }
    } else {
      if (type === 'asbestos-clearance') {
        endpoint = '/pdf/generate-asbestos-clearance';
      } else if (type === 'lead-clearance') {
        endpoint = '/pdf-docraptor-v2/generate-lead-clearance-v2'; // Lead always uses DocRaptor
      } else if (type === 'asbestos-assessment') {
        endpoint = '/pdf/generate-asbestos-assessment';
      } else if (type === 'client-supplied-fibre-id') {
        endpoint = '/pdf-docraptor-v2/generate-client-supplied-fibre-id';
      } else {
        endpoint = '/pdf/generate-asbestos-assessment';
      }
    }

    const url = `${process.env.REACT_APP_API_URL || API_BASE}${endpoint}?t=${Date.now()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDF_REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        clearanceData: type === 'asbestos-clearance' ? data : undefined,
        leadClearanceData: type === 'lead-clearance' ? data : undefined,
        assessmentData: type === 'asbestos-assessment' ? data : undefined,
        jobData: type === 'client-supplied-fibre-id' ? data : undefined,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to generate ${type} PDF: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/pdf')) {
      console.warn('Warning: Response may not be a PDF. Content-Type:', contentType);
    }

    const pdfBlob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `${type}_${new Date().toISOString().slice(0, 10)}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) filename = filenameMatch[1];
    }

    const url2 = window.URL.createObjectURL(pdfBlob);
    try {
      if (openInNewTab) {
        const link = document.createElement('a');
        link.href = url2;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const link = document.createElement('a');
        link.href = url2;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setTimeout(() => window.URL.revokeObjectURL(url2), 1000);
    } catch (error) {
      console.error('Error handling PDF:', error);
      try {
        window.open(url2, '_blank');
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
      }
    }

    return { success: true, filename };
  } catch (error) {
    console.error(`Error generating ${type} PDF:`, error);
    if (error.name === 'AbortError') {
      throw new Error(`PDF generation timed out after ${PDF_REQUEST_TIMEOUT_MS / 1000} seconds. Try again or use a faster connection.`);
    }
    throw error;
  }
};