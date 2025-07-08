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
      asbestosClearanceNonFriable: {
        templateType: "asbestosClearanceNonFriable",
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
          // Front Cover Content
          frontCoverTitle: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
          frontCoverSubtitle: "Clearance Inspection Report",
          
          // Version Control Page Content
          versionControlTitle: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
          preparedForLabel: "PREPARED FOR:",
          preparedByLabel: "PREPARED BY:",
          documentDetailsLabel: "DOCUMENT DETAILS",
          revisionHistoryLabel: "REVISION HISTORY",
          
          // Background Information Content
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING NON-FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:\n\n• Visual inspection of the work area for asbestos dust or debris\n• Visual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris\n\nIt is required that a Non-Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:\n\n• This certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.\n• The asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination\n• The removal area does not pose a risk to health safety and safety from exposure to asbestos",
          
          // Legislative Requirements Content
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:\n\n• ACT Work Health and Safety (WHS) Act 2011\n• ACT Work Health and Safety Regulation 2011\n• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022",
          
          // Non-Friable Clearance Certificate Limitations Content
          nonFriableClearanceCertificateLimitationsTitle: "NON-FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          nonFriableClearanceCertificateLimitationsContent: "The visual clearance inspection was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.",
          
          // Inspection Details Content
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. Photographs of the Asbestos Removal Area and a Site Plan are presented in Appendix A and Appendix B respectively.",
          
          // Inspection Exclusions Content
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.",
          
          // Clearance Certification Content
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          // Sign-off Content
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          // Footer Content
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
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