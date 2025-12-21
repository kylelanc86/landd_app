import api from './axios';

const BASE_URL = '/flowmeter-calibrations';

export const flowmeterCalibrationService = {
  // Get all flowmeter calibrations with optional filtering
  getAll: async (params = {}) => {
    try {
      const response = await api.get(BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get flowmeter calibration by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new flowmeter calibration
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update flowmeter calibration
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete flowmeter calibration
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get flowmeter calibrations by flowmeter ID
  getByFlowmeter: async (flowmeterId) => {
    try {
      const response = await api.get(`${BASE_URL}/flowmeter/${flowmeterId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get flowmeter calibration statistics
  getStats: async () => {
    try {
      const response = await api.get(`${BASE_URL}/stats`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

