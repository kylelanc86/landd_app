import axios from 'axios';
import api from './axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const primaryFlowmeterService = {
  getAll: async (params = {}) => {
    const response = await axios.get(`${API_URL}/primary-flowmeter-calibrations`, {
      params,
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.data;
  },

  getById: async (id) => {
    const response = await axios.get(
      `${API_URL}/primary-flowmeter-calibrations/${id}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.data;
  },

  getByEquipment: async (flowmeterReference) => {
    const response = await axios.get(
      `${API_URL}/primary-flowmeter-calibrations/equipment/${flowmeterReference}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      }
    );
    return response.data;
  },

  create: async (calibrationData) => {
    const response = await api.post('/primary-flowmeter-calibrations', calibrationData);
    return response.data;
  },

  update: async (id, calibrationData) => {
    const response = await api.put(
      `/primary-flowmeter-calibrations/${id}`,
      calibrationData,
    );
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/primary-flowmeter-calibrations/${id}`);
    return response.data;
  },
};

export default primaryFlowmeterService;
