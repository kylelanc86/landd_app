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
  }
};

export default asbestosAssessmentService; 