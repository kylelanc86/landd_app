import api from './api';

const asbestosAssessmentService = {
  // Get all asbestos assessments
  getAll: async (params = {}) => {
    const response = await api.get('/assessments', { params });
    return response.data;
  },

  // Get a single asbestos assessment by ID
  getById: async (id) => {
    const response = await api.get(`/assessments/${id}`);
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

  // Delete an asbestos assessment
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

  // Add photo to assessment item
  addPhotoToItem: async (assessmentId, itemId, photoData, includeInReport = true) => {
    const response = await api.post(
      `/assessments/${assessmentId}/items/${itemId}/photos`,
      { photoData, includeInReport }
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
    const payload = {
      assessmentData,
      ...(options.isResidential === true && { isResidential: true }),
    };
    const response = await api.post(
      '/pdf-docraptor-v2/generate-asbestos-assessment-v3',
      payload,
      { responseType: 'blob' }
    );
    return response.data;
  },
};

export default asbestosAssessmentService; 