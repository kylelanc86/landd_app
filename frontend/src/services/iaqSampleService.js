import api from './axios';

const BASE_URL = '/iaq-samples';

export const iaqSampleService = {
  // Get all IAQ samples
  getAll: async () => {
    try {
      const response = await api.get(BASE_URL);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get IAQ sample by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get samples by IAQ record
  getByIAQRecord: async (iaqRecordId) => {
    try {
      const response = await api.get(`${BASE_URL}/iaq-record/${iaqRecordId}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Create new IAQ sample
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update IAQ sample
  update: async (id, data) => {
    try {
      const response = await api.patch(`${BASE_URL}/${id}`, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Delete IAQ sample
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export default iaqSampleService;
