import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const pcmMicroscopeService = {
  // Get all PCM microscope calibrations
  getAll: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/pcm-microscope-calibrations`, {
        params,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PCM microscope calibrations:', error);
      throw error;
    }
  },

  // Get PCM microscopes from equipment
  getEquipment: async () => {
    try {
      const response = await axios.get(`${API_URL}/pcm-microscope-calibrations/equipment`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PCM microscopes:', error);
      throw error;
    }
  },

  // Get graticules from equipment
  getGraticules: async () => {
    try {
      const response = await axios.get(`${API_URL}/pcm-microscope-calibrations/graticules`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching graticules:', error);
      throw error;
    }
  },

  // Get calibrations by microscope reference
  getByEquipment: async (microscopeReference) => {
    try {
      const response = await axios.get(`${API_URL}/pcm-microscope-calibrations/equipment/${microscopeReference}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching PCM microscope calibrations by equipment:', error);
      throw error;
    }
  },

  // Create new PCM microscope calibration
  create: async (calibrationData) => {
    try {
      const response = await axios.post(`${API_URL}/pcm-microscope-calibrations`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating PCM microscope calibration:', error);
      throw error;
    }
  },

  // Update PCM microscope calibration
  update: async (id, calibrationData) => {
    try {
      const response = await axios.put(`${API_URL}/pcm-microscope-calibrations/${id}`, calibrationData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error updating PCM microscope calibration:', error);
      throw error;
    }
  },

  // Delete PCM microscope calibration
  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_URL}/pcm-microscope-calibrations/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting PCM microscope calibration:', error);
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

export default pcmMicroscopeService;
