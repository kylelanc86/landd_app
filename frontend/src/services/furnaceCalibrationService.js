import axios from 'axios';
import api from './axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const furnaceCalibrationService = {
  getAll: async (params = {}) => {
    const response = await axios.get(`${API_URL}/furnace-calibrations`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await axios.get(`${API_URL}/furnace-calibrations/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  getByEquipment: async (furnaceReference) => {
    const response = await axios.get(
      `${API_URL}/furnace-calibrations/equipment/${furnaceReference}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.data;
  },

  create: async (calibrationData) => {
    const response = await api.post('/furnace-calibrations', calibrationData);
    return response.data;
  },

  update: async (id, calibrationData) => {
    const response = await api.put(`/furnace-calibrations/${id}`, calibrationData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/furnace-calibrations/${id}`);
    return response.data;
  },
};

export default furnaceCalibrationService;
