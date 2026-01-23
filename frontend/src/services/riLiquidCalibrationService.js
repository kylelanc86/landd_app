import api from './axios';

const BASE_URL = '/ri-liquid-calibrations';

export const riLiquidCalibrationService = {
  // Get all RI Liquid calibrations with optional filtering
  getAll: async (params = {}) => {
    try {
      const response = await api.get(BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get RI Liquid calibration by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new RI Liquid calibration
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update RI Liquid calibration
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete RI Liquid calibration
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get RI Liquid calibrations by bottle ID
  getByBottle: async (bottleId) => {
    try {
      const response = await api.get(`${BASE_URL}/bottle/${bottleId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Mark bottle as empty
  markBottleAsEmpty: async (bottleId) => {
    try {
      const response = await api.put(`${BASE_URL}/bottle/${bottleId}/mark-empty`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default riLiquidCalibrationService;
