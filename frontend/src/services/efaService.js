import api from './axios';

const BASE_URL = '/efa-calibrations';

export const efaService = {
  // Get all EFA calibrations with optional filtering
  getAll: async (params = {}) => {
    try {
      const response = await api.get(BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get EFA calibration by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new EFA calibration
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update EFA calibration
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete EFA calibration
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get EFA calibrations by equipment
  getByEquipment: async (efaId) => {
    try {
      const response = await api.get(`${BASE_URL}/equipment/${efaId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get EFA calibration statistics
  getStats: async () => {
    try {
      const response = await api.get(`${BASE_URL}/stats/overview`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all archived EFA calibrations
  getAllArchivedCalibrations: async (params = {}) => {
    try {
      const response = await api.get(`${BASE_URL}/archived`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get archived EFA calibrations for specific equipment
  getArchivedByEquipment: async (equipmentId, params = {}) => {
    try {
      const response = await api.get(`${BASE_URL}/archived`, { 
        params: { ...params, efaId: equipmentId } 
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
