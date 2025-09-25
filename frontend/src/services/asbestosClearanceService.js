import axios from './axios';

const API_BASE_URL = '/asbestos-clearances';

const asbestosClearanceService = {
  // Get all asbestos clearances with optional filters
  getAll: async (params = {}) => {
    const response = await axios.get(API_BASE_URL, { params });
    return response.data;
  },

  // Get single asbestos clearance by ID
  getById: async (id) => {
    const response = await axios.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Create new asbestos clearance
  create: async (clearanceData) => {
    const response = await axios.post(API_BASE_URL, clearanceData);
    return response.data;
  },

  // Update asbestos clearance
  update: async (id, clearanceData) => {
    const response = await axios.put(`${API_BASE_URL}/${id}`, clearanceData);
    return response.data;
  },

  // Delete asbestos clearance
  delete: async (id) => {
    const response = await axios.delete(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Update status only
  updateStatus: async (id, status) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/status`, { status });
    return response.data;
  },

  // Get statistics
  getStats: async () => {
    const response = await axios.get(`${API_BASE_URL}/stats/overview`);
    return response.data;
  },

  // Search clearances
  search: async (searchTerm, filters = {}) => {
    const params = {
      search: searchTerm,
      ...filters
    };
    const response = await axios.get(API_BASE_URL, { params });
    return response.data;
  },

  // Get clearances by status
  getByStatus: async (status) => {
    const response = await axios.get(API_BASE_URL, { 
      params: { status } 
    });
    return response.data;
  },

  // Get clearances by asbestos removalist
  getByRemovalist: async (asbestosRemovalist) => {
    const response = await axios.get(API_BASE_URL, { 
      params: { asbestosRemovalist } 
    });
    return response.data;
  },

  // Upload air monitoring report
  uploadAirMonitoringReport: async (id, reportData) => {
    const response = await axios.post(`${API_BASE_URL}/${id}/air-monitoring-report`, reportData);
    return response.data;
  },

  // Get clearance items
  getItems: async (clearanceId) => {
    const response = await axios.get(`${API_BASE_URL}/${clearanceId}/items`);
    return response.data;
  },

  // Add clearance item
  addItem: async (clearanceId, itemData) => {
    const response = await axios.post(`${API_BASE_URL}/${clearanceId}/items`, itemData);
    return response.data;
  },

  // Update clearance item
  updateItem: async (clearanceId, itemId, itemData) => {
    const response = await axios.put(`${API_BASE_URL}/${clearanceId}/items/${itemId}`, itemData);
    return response.data;
  },

  // Delete clearance item
  deleteItem: async (clearanceId, itemId) => {
    const response = await axios.delete(`${API_BASE_URL}/${clearanceId}/items/${itemId}`);
    return response.data;
  },

  // Get air monitoring reports for a project
  getAirMonitoringReports: async (projectId) => {
    const response = await axios.get(`${API_BASE_URL}/air-monitoring-reports/${projectId}`);
    return response.data;
  },

  // Get air monitoring reports for a specific asbestos removal job
  getAirMonitoringReportsByJob: async (jobId) => {
    const response = await axios.get(`${API_BASE_URL}/air-monitoring-reports-by-job/${jobId}`);
    return response.data;
  }
};

export default asbestosClearanceService; 