import api from './axios';

const createCalibrationService = (resourcePath) => ({
  getAll: async (params = {}) => {
    const response = await api.get(`/${resourcePath}`, { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/${resourcePath}/${id}`);
    return response.data;
  },

  getByEquipment: async (reference) => {
    const response = await api.get(`/${resourcePath}/equipment/${reference}`);
    return response.data;
  },

  create: async (calibrationData) => {
    const response = await api.post(`/${resourcePath}`, calibrationData);
    return response.data;
  },

  update: async (id, calibrationData) => {
    const response = await api.put(`/${resourcePath}/${id}`, calibrationData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/${resourcePath}/${id}`);
    return response.data;
  },
});

export default createCalibrationService;
