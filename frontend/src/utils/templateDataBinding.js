import reportTemplateService from '../services/reportTemplateService';

/**
 * Populates template content with job-specific data
 * @param {Object} clearance - The clearance object with job data
 * @param {Object} template - The template object (optional, will fetch if not provided)
 * @returns {Promise<Object>} - Populated template content
 */
export const populateTemplateContent = async (clearance, template = null) => {
  try {
    // Fetch template if not provided
    if (!template) {
      template = await reportTemplateService.getTemplateByType("asbestosClearance");
    }

    // Extract job data
    const jobData = {
      CLIENT_NAME: clearance.projectId?.client?.name || "Client Name",
      ASBESTOS_TYPE: clearance.clearanceType?.toLowerCase() || "non-friable",
      SITE_NAME: clearance.projectId?.name || "Site Name",
      SITE_ADDRESS: clearance.projectId?.address || "Site Address",
      PROJECT_ID: clearance.projectId?.projectID || "Project ID",
      CLEARANCE_DATE: clearance.clearanceDate 
        ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB")
        : "Clearance Date",
      ASBESTOS_REMOVALIST: clearance.asbestosRemovalist || "Asbestos Removalist",
      LAA_NAME: clearance.LAA || "LAA Name",
      LAA_LICENSE: "AA00031", // This could be made configurable
      INSPECTION_TIME: "Inspection Time", // This could be added to clearance model
      INSPECTION_DATE: clearance.clearanceDate 
        ? new Date(clearance.clearanceDate).toLocaleDateString("en-GB")
        : "Inspection Date",
      REPORT_TYPE: clearance.clearanceType || "Non-friable",
      LOGO_URL: "/images/logo.png",
    };

    // Populate template sections
    const populatedSections = {};
    Object.entries(template.standardSections).forEach(([key, value]) => {
      populatedSections[key] = replacePlaceholders(value, jobData);
    });

    return {
      ...template,
      standardSections: populatedSections,
      jobData,
    };
  } catch (error) {
    console.error("Error populating template content:", error);
    throw error;
  }
};

/**
 * Replaces placeholders in text with actual data
 * @param {string} text - Text containing placeholders
 * @param {Object} data - Data object with replacement values
 * @returns {string} - Text with placeholders replaced
 */
export const replacePlaceholders = (text, data) => {
  if (!text) return "";
  
  let result = text;
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || "");
  });
  
  return result;
};

/**
 * Gets template content for a specific section
 * @param {Object} template - The template object
 * @param {string} sectionKey - The section key to retrieve
 * @param {Object} jobData - Job-specific data for placeholder replacement
 * @returns {string} - Populated section content
 */
export const getSectionContent = (template, sectionKey, jobData = {}) => {
  if (!template?.standardSections?.[sectionKey]) {
    return "";
  }
  
  return replacePlaceholders(template.standardSections[sectionKey], jobData);
};

/**
 * Validates that all required placeholders are provided
 * @param {Object} template - The template object
 * @param {Object} jobData - Job-specific data
 * @returns {Object} - Validation result with missing placeholders
 */
export const validateTemplateData = (template, jobData) => {
  const missingPlaceholders = [];
  const allPlaceholders = new Set();

  // Extract all placeholders from template
  Object.values(template.standardSections).forEach(text => {
    if (text) {
      const matches = text.match(/\{([^}]+)\}/g);
      if (matches) {
        matches.forEach(match => {
          allPlaceholders.add(match.slice(1, -1)); // Remove { and }
        });
      }
    }
  });

  // Check which placeholders are missing from jobData
  allPlaceholders.forEach(placeholder => {
    if (!jobData[placeholder]) {
      missingPlaceholders.push(placeholder);
    }
  });

  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders,
    totalPlaceholders: allPlaceholders.size,
  };
};

/**
 * Creates a preview data object for testing templates
 * @returns {Object} - Sample data for preview
 */
export const getPreviewData = () => {
  return {
    CLIENT_NAME: "Sample Client Pty Ltd",
    ASBESTOS_TYPE: "non-friable",
    SITE_NAME: "123 Sample Street, Canberra ACT",
    SITE_ADDRESS: "123 Sample Street, Canberra ACT 2600",
    PROJECT_ID: "PROJ-2024-001",
    CLEARANCE_DATE: "25 July 2024",
    ASBESTOS_REMOVALIST: "Professional Asbestos Removal",
    LAA_NAME: "Patrick Cerone",
    LAA_LICENSE: "AA00031",
    INSPECTION_TIME: "09:00 AM",
    INSPECTION_DATE: "25 July 2024",
    REPORT_TYPE: "Non-friable",
    LOGO_URL: "/images/logo.png",
  };
}; 