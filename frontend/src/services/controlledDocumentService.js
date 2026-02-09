import api from './axios';

const BASE_URL = '/controlled-documents';

export const controlledDocumentService = {
  getAll: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    const url = queryParams.toString() ? `${BASE_URL}?${queryParams.toString()}` : BASE_URL;
    const response = await api.get(url);
    return response;
  },

  getById: async (id) => {
    const response = await api.get(`${BASE_URL}/${id}`);
    return response;
  },

  getObsolete: async () => {
    const response = await api.get(`${BASE_URL}/obsolete/list`);
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

  delete: async (id) => {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response;
  }
};

export default controlledDocumentService;
