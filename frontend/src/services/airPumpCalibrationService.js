import api from './axios';

const BASE_URL = '/api/air-pump-calibrations';

export const airPumpCalibrationService = {
  // Get all calibrations for a specific pump
  getPumpCalibrations: async (pumpId, page = 1, limit = 50) => {
    try {
      const response = await api.get(`${BASE_URL}/pump/${pumpId}`, {
        params: { page, limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching pump calibrations:', error);
      throw error;
    }
  },

  // Get single calibration record
  getCalibration: async (calibrationId) => {
    try {
      const response = await api.get(`${BASE_URL}/${calibrationId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching calibration:', error);
      throw error;
    }
  },

  // Create new calibration record
  createCalibration: async (calibrationData) => {
    try {
      const response = await api.post(BASE_URL, calibrationData);
      return response.data;
    } catch (error) {
      console.error('Error creating calibration:', error);
      throw error;
    }
  },

  // Update calibration record
  updateCalibration: async (calibrationId, calibrationData) => {
    try {
      const response = await api.put(`${BASE_URL}/${calibrationId}`, calibrationData);
      return response.data;
    } catch (error) {
      console.error('Error updating calibration:', error);
      throw error;
    }
  },

  // Delete calibration record
  deleteCalibration: async (calibrationId) => {
    try {
      const response = await api.delete(`${BASE_URL}/${calibrationId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting calibration:', error);
      throw error;
    }
  },

  // Get calibration statistics for a pump
  getPumpCalibrationStats: async (pumpId) => {
    try {
      const response = await api.get(`${BASE_URL}/pump/${pumpId}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching calibration statistics:', error);
      throw error;
    }
  }
}; 