import api from './axios';

const BASE_URL = '/calibration-frequency';

export const calibrationFrequencyService = {
  // Fixed Calibration Frequency methods
  getFixedFrequencies: async () => {
    try {
      const response = await api.get(`${BASE_URL}/fixed`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getFixedFrequencyById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/fixed/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createFixedFrequency: async (data) => {
    try {
      const response = await api.post(`${BASE_URL}/fixed`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateFixedFrequency: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/fixed/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteFixedFrequency: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/fixed/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Variable Calibration Frequency methods
  getVariableFrequencies: async () => {
    try {
      const response = await api.get(`${BASE_URL}/variable`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getVariableFrequencyById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/variable/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createVariableFrequency: async (data) => {
    try {
      const response = await api.post(`${BASE_URL}/variable`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateVariableFrequency: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/variable/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteVariableFrequency: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/variable/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
