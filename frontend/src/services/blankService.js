import api from './axios';

const BASE_URL = '/blanks';

export const blankService = {
  // Get all blank records
  getAll: async () => {
    try {
      const response = await api.get(BASE_URL);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Get blank record by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Create new blank record
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Update blank record
  update: async (id, data) => {
    try {
      const response = await api.patch(`${BASE_URL}/${id}`, data);
      return response;
    } catch (error) {
      throw error;
    }
  },

  // Delete blank record
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  }
};

export default blankService;
