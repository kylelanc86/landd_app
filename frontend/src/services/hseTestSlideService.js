import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const hseTestSlideService = {
  // Get all HSE Test Slide calibrations
  getAll: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/hse-test-slide-calibrations`, {
        params,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching HSE Test Slide calibrations:', error);
      throw error;
    }
  },

  // Get calibrations by test slide reference
  getByEquipment: async (testSlideReference) => {
    try {
      const response = await axios.get(`${API_URL}/hse-test-slide-calibrations/equipment/${testSlideReference}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching HSE Test Slide calibrations by equipment:', error);
      throw error;
    }
  },

  // Create new HSE Test Slide calibration
  create: async (calibrationData) => {
    try {
      const response = await axios.post(`${API_URL}/hse-test-slide-calibrations`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating HSE Test Slide calibration:', error);
      throw error;
    }
  },

  // Update HSE Test Slide calibration
  update: async (id, calibrationData) => {
    try {
      const response = await axios.put(`${API_URL}/hse-test-slide-calibrations/${id}`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating HSE Test Slide calibration:', error);
      throw error;
    }
  },

  // Delete HSE Test Slide calibration
  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_URL}/hse-test-slide-calibrations/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting HSE Test Slide calibration:', error);
      throw error;
    }
  }
};

export default hseTestSlideService;

