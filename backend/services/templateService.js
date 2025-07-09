const NonFriableClearance = require('../models/NonFriableClearance');
const FriableClearance = require('../models/FriableClearance');
const mongoose = require('mongoose');

/**
 * Fetch template content by type
 * @param {string} templateType - The type of template to fetch
 * @returns {Promise<Object>} - Template content
 */
const getTemplateByType = async (templateType) => {
  try {
    let template = null;
    
    if (templateType === "asbestosClearanceNonFriable") {
      template = await NonFriableClearance.findOne();
    } else if (templateType === "asbestosClearanceFriable") {
      template = await FriableClearance.findOne();
    }
    
    if (!template) {
      console.log(`Template not found for type: ${templateType}, creating default...`);
      
      // Find a system user or create a default ObjectId for createdBy
      const User = require('../models/User');
      let systemUser = await User.findOne({ role: 'admin' }).limit(1);
      let createdBy = systemUser ? systemUser._id : new mongoose.Types.ObjectId();
      
      // Determine the title based on template type
      let title = "ASBESTOS REMOVAL CLEARANCE CERTIFICATE";
      if (templateType === "asbestosClearanceNonFriable") {
        title = "NON-FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE";
      } else if (templateType === "asbestosClearanceFriable") {
        title = "FRIABLE ASBESTOS REMOVAL CLEARANCE CERTIFICATE";
      }
      
      // Create default template if it doesn't exist
      let standardSections = {};
      
      if (templateType === "asbestosClearanceFriable") {
        // Friable clearance content
        standardSections = {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          friableClearanceCertificateLimitationsTitle: "FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          friableClearanceCertificateLimitationsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection {AIR_MONITORING_REFERENCE} following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\n{AIR_MONITORING_RESULTS}\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
        };
        
        template = new FriableClearance({
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      } else {
        // Non-friable clearance content
        standardSections = {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING NON-FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          nonFriableClearanceCertificateLimitationsTitle: "NON-FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          nonFriableClearanceCertificateLimitationsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
        };
        
        template = new NonFriableClearance({
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      }
      
      await template.save();
      return template;
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
    '{INSPECTION_TIME}': (() => {
      if (data.inspectionTime) {
        // Convert 24-hour format to 12-hour format with AM/PM
        const timeMatch = data.inspectionTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1]);
          const minutes = timeMatch[2];
          const ampm = hours >= 12 ? 'PM' : 'AM';
          
          // Convert to 12-hour format
          if (hours === 0) {
            hours = 12; // Midnight
          } else if (hours > 12) {
            hours = hours - 12; // Afternoon/evening
          }
          
          return `${hours}:${minutes} ${ampm}`;
        }
        return data.inspectionTime; // Return as-is if format doesn't match
      }
      return 'Inspection Time';
    })(),
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
    '{SIGNATURE_IMAGE}': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '{APPENDIX_REFERENCES}': (() => {
      const hasSitePlan = data.sitePlan && data.sitePlanFile;
      const hasAirMonitoring = data.airMonitoring;
      
      if (hasSitePlan && hasAirMonitoring) {
        return 'Photographs of the Asbestos Removal Area, Site Plan, and Air Monitoring Report are presented in Appendix A, Appendix B, and Appendix C respectively.';
      } else if (hasSitePlan) {
        return 'Photographs of the Asbestos Removal Area and Site Plan are presented in Appendix A and Appendix B respectively.';
      } else if (hasAirMonitoring) {
        return 'Photographs of the Asbestos Removal Area and Air Monitoring Report are presented in Appendix A and Appendix B respectively.';
      } else {
        return 'Photographs of the Asbestos Removal Area are presented in Appendix A.';
      }
    })(),
    '{AIR_MONITORING_REFERENCE}': data.airMonitoring ? 'and air monitoring' : '',
    '{AIR_MONITORING_RESULTS}': data.airMonitoring ? `Air monitoring was conducted and results were below the clearance indicator of 0.01 fibres per mL.` : ''
  };

  let result = content;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  // Convert line breaks to HTML
  result = result.replace(/\r?\n/g, '<br>');
  
  // Apply simple formatting
  // Process bullet points by splitting into lines and grouping consecutive [BULLET] lines, allowing blank lines between
  const lines = result.split('<br>');
  let processedLines = [];
  let currentBulletList = [];
  let inBulletBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      // Blank line: if in a bullet block, just skip
      if (inBulletBlock) continue;
      // Otherwise, add a blank line
      processedLines.push('');
      continue;
    }
    if (line.startsWith('[BULLET]')) {
      // Start or continue a bullet block
      const bulletContent = line.substring(8);
      currentBulletList.push(bulletContent);
      inBulletBlock = true;
    } else {
      // If we have accumulated bullets, create the ul element
      if (currentBulletList.length > 0) {
        const bulletItems = currentBulletList.map(content => `<li>${content}</li>`).join('');
        processedLines.push(`<ul class="bullets">${bulletItems}</ul>`);
        currentBulletList = [];
        inBulletBlock = false;
      }
      // Add the current line
      processedLines.push(line);
    }
  }
  // Handle any remaining bullets at the end
  if (currentBulletList.length > 0) {
    const bulletItems = currentBulletList.map(content => `<li>${content}</li>`).join('');
    processedLines.push(`<ul class="bullets">${bulletItems}</ul>`);
  }
  result = processedLines.join('<br>');
  
  // Convert **text** to bold
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert [BR] to line breaks
  result = result.replace(/\[BR\]/g, '<br>');

  return result;
};

module.exports = {
  getTemplateByType,
  replacePlaceholders
}; 