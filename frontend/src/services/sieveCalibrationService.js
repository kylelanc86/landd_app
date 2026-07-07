import axios from 'axios';
import api from './axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const sieveCalibrationService = {
  getAll: async (params = {}) => {
    const response = await axios.get(`${API_URL}/sieve-calibrations`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await axios.get(`${API_URL}/sieve-calibrations/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  getByEquipment: async (sieveReference) => {
    const response = await axios.get(
      `${API_URL}/sieve-calibrations/equipment/${sieveReference}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.data;
  },

  create: async (calibrationData) => {
    const response = await api.post('/sieve-calibrations', calibrationData);
    return response.data;
  },

  update: async (id, calibrationData) => {
    const response = await api.put(`/sieve-calibrations/${id}`, calibrationData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/sieve-calibrations/${id}`);
    return response.data;
  },
};

export default sieveCalibrationService;
