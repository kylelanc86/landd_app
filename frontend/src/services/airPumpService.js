import api from './axios';

const airPumpService = {
  // Get all air pumps with pagination and filtering
  getAll: async (params = {}) => {
    const response = await api.get('/air-pumps', { params });
    return response.data;
  },

  // Get single air pump by ID
  getById: async (id) => {
    const response = await api.get(`/air-pumps/${id}`);
    return response.data;
  },

  // Create new air pump
  create: async (pumpData) => {
    const response = await api.post('/air-pumps', pumpData);
    return response.data;
  },

  // Update air pump
  update: async (id, pumpData) => {
    const response = await api.put(`/air-pumps/${id}`, pumpData);
    return response.data;
  },

  // Delete air pump
  delete: async (id) => {
    const response = await api.delete(`/air-pumps/${id}`);
    return response.data;
  },

  // Get air pump statistics
  getStats: async () => {
    const response = await api.get('/air-pumps/stats/overview');
    return response.data;
  },

  // Search air pumps
  search: async (searchTerm, params = {}) => {
    const response = await api.get('/air-pumps', {
      params: { ...params, search: searchTerm }
    });
    return response.data;
  },

  // Filter by status
  filterByStatus: async (status, params = {}) => {
    const response = await api.get('/air-pumps', {
      params: { ...params, status }
    });
    return response.data;
  },

  // Fix date parsing issues
  fixDates: async () => {
    const response = await api.post('/air-pumps/fix-dates');
    return response.data;
  },

  // Update inactive statuses to out of service
  updateInactiveStatus: async () => {
    const response = await api.post('/air-pumps/update-inactive-status');
    return response.data;
  }
};

export default airPumpService; 