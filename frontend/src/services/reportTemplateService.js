import api from './api';

const reportTemplateService = {
  // Get all report templates from unified endpoint
  getAllTemplates: async () => {
    try {
      console.log('Fetching unified report templates...');
      const response = await api.get('/report-templates');
      console.log('Unified report templates:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }
  },

  // Get a specific template by type
  getTemplateByType: async (templateType) => {
    try {
      const response = await api.get(`/report-templates/${templateType}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching report template:', error);
      throw error;
    }
  },

  // Create a new template
  createTemplate: async (templateData) => {
    try {
      const response = await api.post('/report-templates', templateData);
      return response.data;
    } catch (error) {
      console.error('Error creating report template:', error);
      throw error;
    }
  },

  // Update an existing template
  updateTemplate: async (templateType, updateData) => {
    try {
      const response = await api.patch(`/report-templates/${templateType}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating report template:', error);
      throw error;
    }
  },

  // Delete a template
  deleteTemplate: async (templateType) => {
    try {
      const response = await api.delete(`/report-templates/${templateType}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting report template:', error);
      throw error;
    }
  },
};

export default reportTemplateService; 