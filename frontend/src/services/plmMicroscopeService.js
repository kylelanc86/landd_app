import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const plmMicroscopeService = {
  // Get all PLM microscope calibrations
  getAll: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/plm-microscope-calibrations`, {
        params,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PLM microscope calibrations:', error);
      throw error;
    }
  },

  // Get PLM microscopes from equipment
  getEquipment: async () => {
    try {
      const response = await axios.get(`${API_URL}/plm-microscope-calibrations/equipment`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PLM microscopes:', error);
      throw error;
    }
  },

  // Get calibrations by microscope reference
  getByEquipment: async (microscopeReference) => {
    try {
      const response = await axios.get(`${API_URL}/plm-microscope-calibrations/equipment/${microscopeReference}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PLM microscope calibrations by equipment:', error);
      throw error;
    }
  },

  // Create new PLM microscope calibration
  create: async (calibrationData) => {
    try {
      const response = await axios.post(`${API_URL}/plm-microscope-calibrations`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating PLM microscope calibration:', error);
      throw error;
    }
  },

  // Update PLM microscope calibration
  update: async (id, calibrationData) => {
    try {
      const response = await axios.put(`${API_URL}/plm-microscope-calibrations/${id}`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating PLM microscope calibration:', error);
      throw error;
    }
  },

  // Delete PLM microscope calibration
  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_URL}/plm-microscope-calibrations/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting PLM microscope calibration:', error);
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

export default plmMicroscopeService;
