import api from './api';

export const reportTemplateService = {
  // Get all report templates
  getAllTemplates: async () => {
    try {
      const response = await api.get('/report-templates');
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
      const response = await api.put(`/report-templates/${templateType}`, updateData);
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

  // Initialize default templates if they don't exist
  initializeDefaultTemplates: async () => {
    const defaultTemplates = {
      asbestosClearance: {
        templateType: "asbestosClearance",
        companyDetails: {
          name: "Lancaster & Dickenson Consulting Pty Ltd",
          address: "4/6 Dacre Street, Mitchell ACT 2911",
          email: "enquiries@landd.com.au",
          phone: "(02) 6241 2779",
          website: "www.landd.com.au",
          abn: "74 169 785 915"
        },
        reportHeaders: {
          title: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
          subtitle: "Clearance Inspection Report"
        },
        standardSections: {
          introduction: "This report presents the results of the asbestos removal clearance inspection conducted in accordance with the requirements of the Work Health and Safety Act 2011 and associated regulations.",
          methodology: "The clearance inspection was conducted using visual inspection techniques and air monitoring as required by the relevant legislation and industry standards.",
          conclusion: "Based on the inspection results, the area has been cleared for re-occupation following the asbestos removal works.",
          disclaimer: "This report is prepared for the specific purpose stated and should not be used for any other purpose without the written consent of Lancaster & Dickenson Consulting Pty Ltd."
        }
      },
      leadAssessment: {
        templateType: "leadAssessment",
        companyDetails: {
          name: "Lancaster & Dickenson Consulting Pty Ltd",
          address: "4/6 Dacre Street, Mitchell ACT 2911",
          email: "enquiries@landd.com.au",
          phone: "(02) 6241 2779",
          website: "www.landd.com.au",
          abn: "74 169 785 915"
        },
        reportHeaders: {
          title: "LEAD ASSESSMENT REPORT",
          subtitle: "Lead Hazard Assessment"
        },
        standardSections: {
          introduction: "This report presents the results of the lead assessment conducted in accordance with relevant occupational health and safety requirements.",
          methodology: "The assessment was conducted using appropriate sampling and analysis techniques as required by relevant standards and guidelines.",
          conclusion: "Based on the assessment results, recommendations are provided for the management of lead hazards.",
          disclaimer: "This report is prepared for the specific purpose stated and should not be used for any other purpose without the written consent of Lancaster & Dickenson Consulting Pty Ltd."
        }
      },
      mouldAssessment: {
        templateType: "mouldAssessment",
        companyDetails: {
          name: "Lancaster & Dickenson Consulting Pty Ltd",
          address: "4/6 Dacre Street, Mitchell ACT 2911",
          email: "enquiries@landd.com.au",
          phone: "(02) 6241 2779",
          website: "www.landd.com.au",
          abn: "74 169 785 915"
        },
        reportHeaders: {
          title: "MOULD ASSESSMENT REPORT",
          subtitle: "Mould Contamination Assessment"
        },
        standardSections: {
          introduction: "This report presents the results of the mould assessment conducted to evaluate indoor air quality and mould contamination.",
          methodology: "The assessment was conducted using visual inspection and air sampling techniques in accordance with relevant guidelines.",
          conclusion: "Based on the assessment results, recommendations are provided for mould remediation and prevention.",
          disclaimer: "This report is prepared for the specific purpose stated and should not be used for any other purpose without the written consent of Lancaster & Dickenson Consulting Pty Ltd."
        }
      }
    };

    try {
      // Check if templates exist and create them if they don't
      for (const [key, template] of Object.entries(defaultTemplates)) {
        try {
          await api.get(`/report-templates/${template.templateType}`);
        } catch (error) {
          if (error.response?.status === 404) {
            // Template doesn't exist, create it
            await api.post('/report-templates', template);
            console.log(`Created default template for ${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Error initializing default templates:', error);
      throw error;
    }
  }
};

export default reportTemplateService; 