import api from './api';

const customDataFieldGroupService = {
  // Get all custom data field groups
  getAllGroups: async () => {
    const response = await api.get('/custom-data-field-groups');
    return response.data;
  },

  // Get custom data field group by type
  getGroupByType: async (type) => {
    const response = await api.get(`/custom-data-field-groups/type/${type}`);
    return response.data;
  },

  // Get project statuses (requires only projects.view permission)
  getProjectStatuses: async () => {
    const response = await api.get('/custom-data-field-groups/project-statuses');
    return response.data;
  },

  // Get fields by type (simplified interface)
  getFieldsByType: async (type) => {
    const response = await api.get(`/custom-data-field-groups/fields/${type}`);
    return response.data;
  },

  // Create new custom data field group
  createGroup: async (data) => {
    const response = await api.post('/custom-data-field-groups', data);
    return response.data;
  },

  // Update custom data field group
  updateGroup: async (id, data) => {
    const response = await api.put(`/custom-data-field-groups/${id}`, data);
    return response.data;
  },

  // Delete custom data field group (soft delete)
  deleteGroup: async (id) => {
    const response = await api.delete(`/custom-data-field-groups/${id}`);
    return response.data;
  }
};

export default customDataFieldGroupService;
