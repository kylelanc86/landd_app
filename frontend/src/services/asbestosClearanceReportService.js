import axios from './axios';

const API_BASE_URL = '/asbestos-clearance-reports';

const asbestosClearanceReportService = {
  // Get all asbestos clearance reports with optional filters
  getAll: async (params = {}) => {
    const response = await axios.get(API_BASE_URL, { params });
    return response.data;
  },

  // Get reports by clearance ID
  getByClearanceId: async (clearanceId) => {
    const response = await axios.get(`${API_BASE_URL}/clearance/${clearanceId}`);
    return response.data;
  },

  // Get single asbestos clearance report by ID
  getById: async (id) => {
    const response = await axios.get(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Create new asbestos clearance report
  create: async (reportData) => {
    const response = await axios.post(API_BASE_URL, reportData);
    return response.data;
  },

  // Update asbestos clearance report
  update: async (id, reportData) => {
    const response = await axios.put(`${API_BASE_URL}/${id}`, reportData);
    return response.data;
  },

  // Delete asbestos clearance report
  delete: async (id) => {
    const response = await axios.delete(`${API_BASE_URL}/${id}`);
    return response.data;
  },

  // Update status only
  updateStatus: async (id, status) => {
    const response = await axios.patch(`${API_BASE_URL}/${id}/status`, { status });
    return response.data;
  },

  // Search reports
  search: async (searchTerm, filters = {}) => {
    const params = {
      search: searchTerm,
      ...filters
    };
    const response = await axios.get(API_BASE_URL, { params });
    return response.data;
  },

  // Get reports by status
  getByStatus: async (status) => {
    const response = await axios.get(API_BASE_URL, { 
      params: { status } 
    });
    return response.data;
  }
};

export default asbestosClearanceReportService; 