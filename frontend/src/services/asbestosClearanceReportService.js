import api from './axios';

const BASE_URL = '/asbestos-clearance-reports';

const asbestosClearanceReportService = {
  // Get all clearance reports with optional filtering
  getAll: async (params = {}) => {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  // Get clearance reports by clearance ID
  getByClearanceId: async (clearanceId) => {
    const response = await api.get(`${BASE_URL}/clearance/${clearanceId}`);
    return response.data;
  },

  // Get a single clearance report by ID
  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create a new clearance report
  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response.data;
  },

  // Update a clearance report
  update: async (id, data) => {
    const response = await api.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete a clearance report
  delete: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },
};

export default asbestosClearanceReportService; 