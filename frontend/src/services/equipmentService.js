import api from './axios';

const BASE_URL = '/equipment';

export const equipmentService = {
  // Get all equipment with optional filtering
  getAll: async (params = {}) => {
    try {
      const requestParams = { limit: 300, ...params };
      const response = await api.get(BASE_URL, { params: requestParams });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get equipment by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new equipment
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update equipment
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete equipment
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get equipment statistics
  getStats: async () => {
    try {
      const response = await api.get(`${BASE_URL}/stats/overview`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get equipment due for calibration
  getDueForCalibration: async (days = 30) => {
    try {
      const response = await api.get(`${BASE_URL}/calibrations/due`, {
        params: { days }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get equipment types for dropdown
  getTypes: async () => {
    try {
      const response = await api.get(`${BASE_URL}/types/list`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get labs for dropdown
  getLabs: async () => {
    try {
      const response = await api.get(`${BASE_URL}/labs/list`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get equipment type options (static)
  getEquipmentTypes: () => [
    "Acetone Vaporiser",
    "Air pump",
    "Bubble flowmeter",
    "Effective Filter Area",
    "Filter Holder",
    "Fume Hood",
    "Furnace",
    "Graticule",
    "HSE Test Slide",
    "Micrometer",
    "Microscope",
    "Pneumatic tester",
    "RI Liquids",
    "Site flowmeter"
  ],

  // Get section options (static)
  getSections: () => [
    "Air Monitoring",
    "Fibre ID"
  ],

  // Get status options (static)
  getStatusOptions: () => [
    "active",
    "calibration due",
    "out-of-service"
  ]
}; 