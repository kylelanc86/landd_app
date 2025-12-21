import api from './axios';

const BASE_URL = '/graticule-calibrations';

export const graticuleService = {
  // Get all graticule calibrations with optional filtering
  getAll: async (params = {}) => {
    try {
      const response = await api.get(BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get graticule calibration by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new graticule calibration
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update graticule calibration
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete graticule calibration
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get graticule calibrations by microscope
  getByMicroscope: async (microscopeId) => {
    try {
      const response = await api.get(`${BASE_URL}/microscope/${microscopeId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get graticule calibration statistics
  getStats: async () => {
    try {
      const response = await api.get(`${BASE_URL}/stats`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all archived graticule calibrations
  getAllArchivedCalibrations: async (params = {}) => {
    try {
      const response = await api.get(`${BASE_URL}/archived`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get archived graticule calibrations for specific equipment
  getArchivedByEquipment: async (equipmentId, params = {}) => {
    try {
      const response = await api.get(`${BASE_URL}/archived/${equipmentId}`, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
