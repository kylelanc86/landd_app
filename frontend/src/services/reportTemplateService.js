import api from './api';

const reportTemplateService = {
  // Get all report templates from all endpoints
  getAllTemplates: async () => {
    try {
      console.log('Fetching asbestos clearance templates...');
      const asbestosClearanceTemplates = await api.get('/asbestos-clearance-templates');
      console.log('Asbestos clearance templates:', asbestosClearanceTemplates.data);
      
      console.log('Fetching lead assessment templates...');
      const leadAssessmentTemplates = await api.get('/lead-assessment-templates');
      console.log('Lead assessment templates:', leadAssessmentTemplates.data);
      
      console.log('Fetching asbestos assessment templates...');
      const asbestosAssessmentTemplates = await api.get('/asbestos-assessment-templates');
      console.log('Asbestos assessment templates:', asbestosAssessmentTemplates.data);

      // Combine all templates
      const allTemplates = [
        ...asbestosClearanceTemplates.data,
        ...leadAssessmentTemplates.data,
        ...asbestosAssessmentTemplates.data
      ];

      console.log('Combined all templates:', allTemplates);
      return allTemplates;
    } catch (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }
  },

  // Get a specific template by type
  getTemplateByType: async (templateType) => {
    try {
      let response;
      
      if (templateType === 'asbestosClearanceNonFriable' || templateType === 'asbestosClearanceFriable' || templateType === 'asbestosClearanceMixed') {
        response = await api.get(`/asbestos-clearance-templates/${templateType}`);
      } else if (templateType === 'leadAssessment') {
        response = await api.get(`/lead-assessment-templates/${templateType}`);
      } else if (templateType === 'asbestosAssessment') {
        response = await api.get(`/asbestos-assessment-templates/${templateType}`);
      } else {
        throw new Error(`Unknown template type: ${templateType}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching report template:', error);
      throw error;
    }
  },

  // Create a new template
  createTemplate: async (templateData) => {
    try {
      const { templateType } = templateData;
      let response;
      
      if (templateType === 'asbestosClearanceNonFriable' || templateType === 'asbestosClearanceFriable' || templateType === 'asbestosClearanceMixed') {
        response = await api.post('/asbestos-clearance-templates', templateData);
      } else if (templateType === 'leadAssessment') {
        response = await api.post('/lead-assessment-templates', templateData);
      } else if (templateType === 'asbestosAssessment') {
        response = await api.post('/asbestos-assessment-templates', templateData);
      } else {
        throw new Error(`Unknown template type: ${templateType}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating report template:', error);
      throw error;
    }
  },

  // Update an existing template
  updateTemplate: async (templateType, updateData) => {
    try {
      let response;
      
      if (templateType === 'asbestosClearanceNonFriable' || templateType === 'asbestosClearanceFriable' || templateType === 'asbestosClearanceMixed') {
        response = await api.put(`/asbestos-clearance-templates/${templateType}`, updateData);
      } else if (templateType === 'leadAssessment') {
        response = await api.put(`/lead-assessment-templates/${templateType}`, updateData);
      } else if (templateType === 'asbestosAssessment') {
        response = await api.put(`/asbestos-assessment-templates/${templateType}`, updateData);
      } else {
        throw new Error(`Unknown template type: ${templateType}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating report template:', error);
      throw error;
    }
  },

  // Delete a template
  deleteTemplate: async (templateType) => {
    try {
      let response;
      
      if (templateType === 'asbestosClearanceNonFriable' || templateType === 'asbestosClearanceFriable') {
        response = await api.delete(`/asbestos-clearance-templates/${templateType}`);
      } else if (templateType === 'leadAssessment') {
        response = await api.delete(`/lead-assessment-templates/${templateType}`);
      } else if (templateType === 'asbestosAssessment') {
        response = await api.delete(`/asbestos-assessment-templates/${templateType}`);
      } else {
        throw new Error(`Unknown template type: ${templateType}`);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error deleting report template:', error);
      throw error;
    }
  },
};

export default reportTemplateService; 