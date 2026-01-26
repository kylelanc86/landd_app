import api from './axios';

const BASE_URL = '/iaq-records';

export const iaqRecordService = {
  // Get all IAQ records
  getAll: async () => {
    try {
      const response = await api.get(BASE_URL);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get IAQ record by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Create new IAQ record
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update IAQ record
  update: async (id, data) => {
    try {
      const response = await api.patch(`${BASE_URL}/${id}`, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Delete IAQ record
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Authorise IAQ report
  authorise: async (id) => {
    try {
      const response = await api.post(`${BASE_URL}/${id}/authorise`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Send for authorisation
  sendForAuthorisation: async (id) => {
    try {
      const response = await api.post(`${BASE_URL}/${id}/send-for-authorisation`);
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export default iaqRecordService;
