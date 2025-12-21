import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const stereomicroscopeService = {
  // Get all Stereomicroscope calibrations
  getAll: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/stereomicroscope-calibrations`, {
        params,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Stereomicroscope calibrations:', error);
      throw error;
    }
  },

  // Get Stereomicroscopes from equipment
  getEquipment: async () => {
    try {
      const response = await axios.get(`${API_URL}/stereomicroscope-calibrations/equipment`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Stereomicroscopes:', error);
      throw error;
    }
  },

  // Get calibrations by microscope reference
  getByEquipment: async (microscopeReference) => {
    try {
      const response = await axios.get(`${API_URL}/stereomicroscope-calibrations/equipment/${microscopeReference}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching Stereomicroscope calibrations by equipment:', error);
      throw error;
    }
  },

  // Create new Stereomicroscope calibration
  create: async (calibrationData) => {
    try {
      const response = await axios.post(`${API_URL}/stereomicroscope-calibrations`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating Stereomicroscope calibration:', error);
      throw error;
    }
  },

  // Update Stereomicroscope calibration
  update: async (id, calibrationData) => {
    try {
      const response = await axios.put(`${API_URL}/stereomicroscope-calibrations/${id}`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating Stereomicroscope calibration:', error);
      throw error;
    }
  },

  // Delete Stereomicroscope calibration
  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_URL}/stereomicroscope-calibrations/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting Stereomicroscope calibration:', error);
      throw error;
    }
  },

  // Upload service report
  uploadServiceReport: async (file) => {
    try {
      const formData = new FormData();
      formData.append('serviceReport', file);

      const response = await axios.post(`${API_URL}/upload/service-report`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading service report:', error);
      throw error;
    }
  }
};

export default stereomicroscopeService;
