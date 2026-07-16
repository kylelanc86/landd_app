import api from './api';
import { getAxiosDownloadFilename } from '../utils/downloadFilename';
import {
  buildAsbestosAssessmentFilename,
  isPlaceholderReportReference,
  withRevisionAndExtension,
} from '../utils/reportFilenames';

function buildAssessmentDownloadFallback(assessmentData, isResidential = false) {
  if (!isPlaceholderReportReference(assessmentData?.reportReference)) {
    return withRevisionAndExtension(
      assessmentData.reportReference,
      assessmentData.revision,
    );
  }
  return buildAsbestosAssessmentFilename({
    projectId:
      assessmentData?.projectId?.projectID || assessmentData?.jobReference,
    siteName: assessmentData?.projectId?.name || assessmentData?.siteName,
    reportIssueDate: assessmentData?.reportAuthorisedAt,
    revision: assessmentData?.revision,
    isResidential,
  });
}

const asbestosAssessmentService = {
  // Get all asbestos assessments
  getAll: async (params = {}) => {
    const response = await api.get('/assessments', { params });
    return response.data;
  },

  // Get a single asbestos assessment by ID
  // options.omitPhotoData: omit base64 from item/referred photos (lazy-load via getItemPhotosData / getReferredPhotosData)
  // options.omitPlanFiles: omit site / appendix plan image payloads (counts preserved on assessment)
  // options.omitFibreReport: omit analysis PDF string (hasFibreAnalysisReport boolean set)
  // options.omitItems: items array empty (load items separately, e.g. per tab)
  // options.itemsMaterialTypes: comma-separated materialType filter (e.g. "paint,dust")
  getById: async (id, options = {}) => {
    const params = {};
    if (options.omitPhotoData) params.omitPhotoData = '1';
    if (options.omitPlanFiles) params.omitPlanFiles = '1';
    if (options.omitFibreReport) params.omitFibreReport = '1';
    if (options.omitItems) params.omitItems = '1';
    if (options.itemsMaterialTypes) {
      params.itemsMaterialTypes = options.itemsMaterialTypes;
    }
    const response = await api.get(`/assessments/${id}`, { params });
    return response.data;
  },

  /** Full image payloads for all photos on an assessment item (for lazy gallery load). */
  getItemPhotosData: async (assessmentId, itemId) => {
    const response = await api.get(
      `/assessments/${assessmentId}/items/${itemId}/photos/data`
    );
    return response.data;
  },

  /** Full image payloads for photos on a referred location row. */
  getReferredPhotosData: async (assessmentId, itemId, referredIndex) => {
    const response = await api.get(
      `/assessments/${assessmentId}/items/${itemId}/referred-locations/${referredIndex}/photos/data`
    );
    return response.data;
  },

  // Create a new asbestos assessment
  create: async (assessmentData) => {
    const response = await api.post('/assessments', assessmentData);
    return response.data;
  },

  // Update an asbestos assessment
  update: async (id, assessmentData) => {
    const response = await api.put(`/assessments/${id}`, assessmentData);
    return response.data;
  },

  /** Reopen authorised assessment for editing from Project Reports (increments revision, clears sign-off). */
  reviseReport: async (id) => {
    const response = await api.patch(`/assessments/${id}/revise-report`);
    return response.data;
  },

  // Restore soft-deleted asbestos assessment
  restore: async (id) => {
    const response = await api.patch(`/assessments/${id}/restore`);
    return response.data;
  },

  // Delete (soft-delete) an asbestos assessment
  delete: async (id) => {
    const response = await api.delete(`/assessments/${id}`);
    return response.data;
  },

  // Get assessment items
  getItems: async (id) => {
    const response = await api.get(`/assessments/${id}/items`);
    return response.data;
  },

  // Add item to assessment
  addItem: async (id, itemData) => {
    const response = await api.post(`/assessments/${id}/items`, itemData);
    return response.data;
  },

  // Update assessment item
  updateItem: async (assessmentId, itemId, itemData) => {
    const response = await api.put(`/assessments/${assessmentId}/items/${itemId}`, itemData);
    return response.data;
  },

  // Reorder assessment items (array order drives UI + report)
  reorderItems: async (assessmentId, itemIds) => {
    const response = await api.put(`/assessments/${assessmentId}/items/reorder`, {
      itemIds,
    });
    return response.data;
  },

  // Delete assessment item
  deleteItem: async (assessmentId, itemId) => {
    const response = await api.delete(`/assessments/${assessmentId}/items/${itemId}`);
    return response.data;
  },

  // Generate Chain of Custody PDF
  generateChainOfCustody: async (assessmentId) => {
    const response = await api.get(`/assessments/${assessmentId}/chain-of-custody`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Update only assessment workflow status
  updateStatus: async (assessmentId, status) => {
    const response = await api.patch(`/assessments/${assessmentId}/status`, { status });
    return response.data;
  },

  // Upload fibre/analysis report PDF (base64 data URL string)
  uploadFibreAnalysisReport: async (assessmentId, reportData) => {
    const response = await api.post(`/assessments/${assessmentId}/upload-fibre-analysis-report`, {
      reportData,
    });
    return response.data;
  },

  deleteFibreAnalysisReport: async (assessmentId) => {
    const response = await api.delete(`/assessments/${assessmentId}/fibre-analysis-report`);
    return response.data;
  },

  // Add photo to assessment item
  addPhotoToItem: async (
    assessmentId,
    itemId,
    photoData,
    includeInReport = true,
    fullResolutionData = null,
  ) => {
    const payload = { photoData, includeInReport };
    if (fullResolutionData) {
      payload.fullResolutionData = fullResolutionData;
    }
    const response = await api.post(
      `/assessments/${assessmentId}/items/${itemId}/photos`,
      payload
    );
    return response.data;
  },

  // Delete photo from assessment item
  deletePhotoFromItem: async (assessmentId, itemId, photoId) => {
    const response = await api.delete(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}`
    );
    return response.data;
  },

  // Toggle photo inclusion in report
  togglePhotoInReport: async (assessmentId, itemId, photoId) => {
    const response = await api.patch(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/toggle`
    );
    return response.data;
  },

  // Replace photo pixels and/or full arrows array (used after rotate)
  updatePhotoContent: async (assessmentId, itemId, photoId, { photoData, arrows }) => {
    const response = await api.patch(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}`,
      { photoData, arrows }
    );
    return response.data;
  },

  // Update photo description
  updatePhotoDescription: async (assessmentId, itemId, photoId, description) => {
    const response = await api.patch(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/description`,
      { description }
    );
    return response.data;
  },

  // Add arrow to photo. Defaults: red, -45deg.
  addPhotoArrow: async (assessmentId, itemId, photoId, arrow) => {
    const response = await api.post(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/arrows`,
      {
        x: arrow.x ?? 0.5,
        y: arrow.y ?? 0.5,
        rotation: arrow.rotation ?? -45,
        color: arrow.color ?? '#f44336',
      }
    );
    return response.data;
  },

  // Update one arrow (position/rotation/color).
  updatePhotoArrow: async (assessmentId, itemId, photoId, arrowId, updates) => {
    const response = await api.patch(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/arrows/${arrowId}`,
      updates
    );
    return response.data;
  },

  // Delete one arrow.
  deletePhotoArrow: async (assessmentId, itemId, photoId, arrowId) => {
    const response = await api.delete(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/arrows/${arrowId}`
    );
    return response.data;
  },

  // Legacy: set/clear single arrow (clears all arrows and sets one, or clears all).
  updatePhotoArrowLegacy: async (assessmentId, itemId, photoId, arrow) => {
    const response = await api.patch(
      `/assessments/${assessmentId}/items/${itemId}/photos/${photoId}/arrow`,
      arrow === null ? { arrow: null } : arrow
    );
    return response.data;
  },

  // Generate asbestos assessment PDF using DocRaptor templates (pdf-docraptor-v2)
  // options.isResidential: when true, cover/version control and footer use "Residential Asbestos Assessment Report" and filename includes "Residential"
  generateAsbestosAssessmentPdf: async (assessmentData, options = {}) => {
    const isResidential = options.isResidential === true;
    const payload = {
      assessmentData,
      ...(isResidential && { isResidential: true }),
    };
    const response = await api.post(
      '/pdf-docraptor-v2/generate-asbestos-assessment-v3',
      payload,
      { responseType: 'blob' }
    );
    const filename = getAxiosDownloadFilename(
      response,
      buildAssessmentDownloadFallback(assessmentData, isResidential),
    );
    return { blob: response.data, filename };
  },
};

export default asbestosAssessmentService; 