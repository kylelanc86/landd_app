import api from './axios';

const BASE_URL = '/incidents';

export const incidentService = {
  getAll: async () => {
    const response = await api.get(BASE_URL);
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response;
  },

  create: async (data) => {
    const response = await api.post(BASE_URL, data);
    return response;
  },

  update: async (id, data) => {
    const response = await api.patch(`${BASE_URL}/${id}`, data);
    return response;
  },

  signOff: async (id, data) => {
    const response = await api.patch(`${BASE_URL}/${id}/sign-off`, data);
    return response;
  },

  delete: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response;
  }
};

export default incidentService;
