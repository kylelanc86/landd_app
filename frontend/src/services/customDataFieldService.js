import api from './api';

const customDataFieldService = {
  // Get all custom data fields by type
  getByType: async (type) => {
    const response = await api.get(`/custom-data-fields/${type}`);
    return response.data;
  },

  // Get all custom data fields
  getAll: async () => {
    const response = await api.get('/custom-data-fields');
    return response.data;
  },

  // Create new custom data field
  create: async (data) => {
    const response = await api.post('/custom-data-fields', data);
    return response.data;
  },

  // Update custom data field
  update: async (id, data) => {
    const response = await api.put(`/custom-data-fields/${id}`, data);
    return response.data;
  },

  // Delete custom data field (soft delete)
  delete: async (id) => {
    const response = await api.delete(`/custom-data-fields/${id}`);
    return response.data;
  }
};

export default customDataFieldService;
