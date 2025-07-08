const ReportTemplate = require('../models/ReportTemplate');

/**
 * Fetch template content by type
 * @param {string} templateType - The type of template to fetch
 * @returns {Promise<Object>} - Template content
 */
const getTemplateByType = async (templateType) => {
  try {
    const template = await ReportTemplate.findOne({ templateType });
    if (!template) {
      console.log(`Template not found for type: ${templateType}, creating default...`);
      // Create default template if it doesn't exist
      const defaultTemplate = new ReportTemplate({
        templateType,
        createdBy: 'system', // You might want to pass a user ID here
        standardSections: {
          // Default content for non-friable clearance
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING NON-FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:\n\nVisual inspection of the work area for asbestos dust or debris\nVisual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris\n\nIt is required that a Non-Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:\n\nThis certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.\nThe asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination\nThe removal area does not pose a risk to health safety and safety from exposure to asbestos",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:\n\nACT Work Health and Safety (WHS) Act 2011\nACT Work Health and Safety Regulation 2011\nACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022",
          
          nonFriableClearanceCertificateLimitationsTitle: "NON-FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          nonFriableClearanceCertificateLimitationsContent: "The visual clearance inspection was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. Photographs of the Asbestos Removal Area and a Site Plan are presented in Appendix A and Appendix B respectively.",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
        }
      });
      await defaultTemplate.save();
      return defaultTemplate;
    }
    return template;
  } catch (error) {
    console.error('Error fetching template:', error);
    throw error;
  }
};

/**
 * Replace placeholders in template content with actual data
 * @param {string} content - Template content with placeholders
 * @param {Object} data - Data to replace placeholders with
 * @returns {string} - Content with replaced placeholders
 */
const replacePlaceholders = async (content, data) => {
  if (!content) return '';
  
  // Look up user's Asbestos Assessor licence number and signature
  let laaLicenceNumber = 'AA00031'; // Default fallback
  let userSignature = null;
  
  if (data.LAA) {
    try {
      const User = require('../models/User');
      const user = await User.findOne({
        $or: [
          { firstName: { $regex: new RegExp(data.LAA.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(data.LAA.split(' ')[1] || '', 'i') } },
          { firstName: { $regex: new RegExp(data.LAA, 'i') } },
          { lastName: { $regex: new RegExp(data.LAA, 'i') } }
        ]
      });
      
      if (user) {
        // Get user's signature
        if (user.signature) {
          userSignature = user.signature;
          console.log(`Found signature for ${data.LAA}`);
        }
        
        // Find the Asbestos Assessor licence
        if (user.licences && user.licences.length > 0) {
          const asbestosAssessorLicence = user.licences.find(licence => 
            licence.licenceType === 'Asbestos Assessor' || 
            licence.licenceType === 'LAA'
          );
          
          if (asbestosAssessorLicence) {
            laaLicenceNumber = asbestosAssessorLicence.licenceNumber;
            console.log(`Found LAA licence for ${data.LAA}: ${laaLicenceNumber}`);
          } else {
            console.log(`No Asbestos Assessor licence found for ${data.LAA}`);
          }
        }
      } else {
        console.log(`User not found for LAA: ${data.LAA}`);
      }
    } catch (error) {
      console.error('Error looking up user licence and signature:', error);
    }
  }
  
  const replacements = {
    '{CLIENT_NAME}': data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '{ASBESTOS_TYPE}': data.clearanceType?.toLowerCase() || 'non-friable',
    '{SITE_NAME}': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '{ASBESTOS_REMOVALIST}': data.asbestosRemovalist || 'Unknown Removalist',
    '{LAA_NAME}': data.LAA || data.laaName || 'Unknown LAA',
    '{LAA_LICENSE}': laaLicenceNumber,
    '{INSPECTION_TIME}': 'Inspection Time',
    '{INSPECTION_DATE}': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '{REPORT_TYPE}': data.clearanceType || 'Non-friable',
    '{CLEARANCE_DATE}': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '{CLEARANCE_TIME}': 'Clearance Time',
    '{PROJECT_NAME}': data.projectId?.name || data.project?.name || 'Unknown Project',
    '{PROJECT_NUMBER}': data.projectId?.projectID || data.project?.projectID || 'Unknown Project ID',
    '{SITE_ADDRESS}': data.projectId?.name || data.project?.name || 'Unknown Address',
    '{SIGNATURE_IMAGE}': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]'
  };

  let result = content;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  // Convert line breaks to HTML line breaks for proper display in PDF
  result = result.replace(/\n/g, '<br>');

  // Note: Bullet points are handled by HTML templates, not automatic conversion
  // This prevents double bullet points when templates already contain <ul> and <li> tags

  return result;
};

module.exports = {
  getTemplateByType,
  replacePlaceholders
}; 