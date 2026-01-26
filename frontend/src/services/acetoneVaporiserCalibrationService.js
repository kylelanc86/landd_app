import api from './axios';

const BASE_URL = '/acetone-vaporiser-calibrations';

export const acetoneVaporiserCalibrationService = {
  // Get all acetone vaporiser calibrations with optional filtering
  getAll: async (params = {}) => {
    try {
      const response = await api.get(BASE_URL, { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get acetone vaporiser calibration by ID
  getById: async (id) => {
    try {
      const response = await api.get(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new acetone vaporiser calibration
  create: async (data) => {
    try {
      const response = await api.post(BASE_URL, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update acetone vaporiser calibration
  update: async (id, data) => {
    try {
      const response = await api.put(`${BASE_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete acetone vaporiser calibration
  delete: async (id) => {
    try {
      const response = await api.delete(`${BASE_URL}/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get acetone vaporiser calibrations by equipment ID
  getByEquipment: async (equipmentId) => {
    try {
      const response = await api.get(`${BASE_URL}/equipment/${equipmentId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export default acetoneVaporiserCalibrationService;
