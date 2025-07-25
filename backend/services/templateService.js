const NonFriableClearance = require('../models/clearanceTemplates/asbestos/NonFriableClearance');
const FriableClearance = require('../models/clearanceTemplates/asbestos/FriableClearance');
const AsbestosAssessmentTemplate = require('../models/assessmentTemplates/asbestos/AsbestosAssessmentTemplate');
const mongoose = require('mongoose');

// Simple in-memory cache for user lookups during PDF generation
const userLookupCache = new Map();

/**
 * Clear the user lookup cache (call this after PDF generation is complete)
 */
const clearUserLookupCache = () => {
  userLookupCache.clear();
  console.log('[TEMPLATE SERVICE] User lookup cache cleared');
};

/**
 * Fetch template content by type
 * @param {string} templateType - The type of template to fetch
 * @returns {Promise<Object>} - Template content
 */
const getTemplateByType = async (templateType) => {
  try {
    let template = null;
    
    // Add timeout to prevent hanging database queries
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Template lookup timeout')), 10000); // 10 second timeout
    });
    
    // Race between the database query and timeout
    const templateQuery = async () => {
      if (templateType === "asbestosClearanceNonFriable") {
        return await NonFriableClearance.findOne();
      } else if (templateType === "asbestosClearanceFriable") {
        return await FriableClearance.findOne();
      } else if (templateType === "asbestosAssessment") {
        return await AsbestosAssessmentTemplate.findOne();
      }
      return null;
    };
    
    template = await Promise.race([templateQuery(), timeoutPromise]);
    
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
      } else if (templateType === "asbestosAssessment") {
        title = "ASBESTOS MATERIAL ASSESSMENT REPORT";
      }
      
      // Create default template if it doesn't exist
      let standardSections = {};
      
      if (templateType === "asbestosAssessment") {
        // Asbestos assessment content - hardcoded like clearance templates
        standardSections = {
          introductionTitle: "INTRODUCTION",
          introductionContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake an asbestos assessment at {SITE_NAME}. {LAA_NAME} (Licenced Asbestos Assessor - {LAA_LICENSE}) from L & D subsequently visited the above location on {ASSESSMENT_DATE} to undertake the assessment.\n\nThis report covers the inspection and assessment of the following areas/materials only:\n{ASSESSMENT_SCOPE_BULLETS}",
          
          surveyFindingsTitle: "SURVEY FINDINGS",
          surveyFindingsContent: "Table 1 below details the suspected ACM sampled as part of the assessment. Information is also included regarding materials which are presumed to contain asbestos and materials which the assessor visually assessed to be the consistent with a sampled material. Photographs of assessed materials are also presented in the sample register below.\n\nSample analysis was undertaken by L&D's National Association of Testing Authorities (NATA) accredited laboratory. The samples were analysed by Polarised Light Microscopy using dispersion staining techniques in accordance with AS 4964-2004.",
          
          discussionTitle: "DISCUSSION AND CONCLUSIONS",
          discussionContent: "The following asbestos-containing materials were identified during the assessment:\n{IDENTIFIED_ASBESTOS_ITEMS}",
          
          riskAssessmentTitle: "RISK ASSESSMENT",
          riskAssessmentContent: "Identified ACM was risk assessed based on the following criteria:\n• the condition of the material at the time of the assessment;\n• the accessibility of the material;\n• the likelihood of the material being disturbed resulting in a release of asbestos fibre.\nEach ACM is categorised into one of four (4) risk categories:",
          
          controlMeasuresTitle: "DETERMINING SUITABLE CONTROL MEASURES",
          controlMeasuresContent: "The Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022 requires that when choosing the most appropriate control measure for managing ACM or asbestos, the following hierarchy of controls must be considered:\n• eliminating the risk, for example: removing the asbestos (most preferred)\n• substituting for the risk, isolating the risk or applying engineering controls, for example: enclosing, encapsulation or sealing\n• using administrative controls, for example: labelling, safe work practices etc.\n• using PPE (least preferred)\nA combination of these controls may be required in order to adequately manage and control asbestos or ACM.",
          
          remediationRequirementsTitle: "REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM",
          remediationRequirementsContent: "Prior to Work Commencing\nPrior to the commencement of any works associated with asbestos, the licensed asbestos removalist is required to notify Worksafe ACT five (5) days prior to commencement of asbestos removal works. As part of the notification process the licensed removalist must supply an Asbestos Removal Control Plan (ARCP) and a Safe Work Method Statement (SWMS) outlining how the works are to be undertaken.\n\nAsbestos Removal Works\nFriable asbestos removal or remediation work must be undertaken by an ACT licensed Class A Asbestos Removalist. Air monitoring, which is mandatory during the removal or remediation of friable asbestos, must be undertaken in accordance with the Guidance Note on the Membrane Filter Method for Estimating Airborne Asbestos Fibres, 2nd Edition [NOHSC: 3003(2005)].\n\nNon-friable asbestos removal or remediation must be undertaken by a Class A or B Asbestos Removalist. Air monitoring is not mandatory for the removal of non-friable asbestos.\n\nAll asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022) and in accordance with EPA (2011) Contaminated Sites Information Sheet No. 5 'Requirements for the Transport and Disposal of Asbestos Contaminated Wastes' and Information Sheet No.6 'Management of Small Scale, Low Risk Soil Asbestos Contamination'.\n\nFollowing Completion of Asbestos Removal Works\nOn completion of asbestos removal or remediation works an independent ACT licensed Asbestos Assessor must be employed to undertake a Clearance Inspection. A satisfactory clearance certificate for the remediated areas must include no visible suspect material and where applicable, clearance monitoring must also indicate that airborne fibre levels are satisfactory.",
          
          legislationTitle: "LEGISLATION",
          legislationContent: "This report was written in general accordance with and with reference to:\n• ACT Work Health and Safety (WHS) Act 2011\n• ACT Work Health and Safety Regulation 2011\n• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) Approval 2022\n• ACT Work Health and Safety (How to Manage and Control Asbestos in the Workplace Code of Practice) Approval 2022",
          
          assessmentLimitationsTitle: "ASSESSMENT LIMITATIONS/CAVEATS",
          assessmentLimitationsContent: "This report covers the inspection and assessment of the location and materials outlined within this document only and is specific to the date the assessment was conducted. L&D did not inspect any areas of the property that fall outside of the locations listed in this report and therefore make no comment regarding the presence or condition of further ACM that may or may not be present.\n\nWhilst every effort has been made to identify all ACM within the inspected areas, the random nature in which asbestos was often installed can mean unidentified asbestos may be uncovered/identified. Should suspect ACM be identified or disturbed, works should cease until an assessment of the materials is completed.",
          
          signOffContent: "For and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME} - Licensed Asbestos Assessor\n{LAA_LICENSE}\nLancaster & Dickenson Consulting Pty Ltd",
          
          signaturePlaceholder: "{SIGNATURE_IMAGE}",
          
          footerText: "Asbestos Assessment Report - {SITE_NAME}",
        };
        
        template = new AsbestosAssessmentTemplate({
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Assessment Report"
          },
          standardSections
        });
      } else if (templateType === "asbestosClearanceFriable") {
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
  
  // Handle both clearance (LAA) and assessment (assessorId) user lookups
  let userIdentifier = data.LAA || data.assessorId;
  
  // Handle assessorId object structure for assessments
  if (data.assessorId && typeof data.assessorId === 'object') {
    userIdentifier = data.assessorId.firstName + ' ' + data.assessorId.lastName;
  }
  
  if (userIdentifier) {
    // Check cache first
    if (userLookupCache.has(userIdentifier)) {
      const cachedUser = userLookupCache.get(userIdentifier);
      console.log('[TEMPLATE SERVICE] Using cached user data for:', userIdentifier);
      laaLicenceNumber = cachedUser.licenceNumber;
      userSignature = cachedUser.signature;
    } else {
      try {
        console.log('[TEMPLATE SERVICE] Looking up user with identifier:', userIdentifier);
        const User = require('../models/User');
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('User lookup timeout')), 5000); // 5 second timeout
        });
        
        // Check if userIdentifier is a valid ObjectId (24 hex characters)
        const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(userIdentifier);
        console.log('[TEMPLATE SERVICE] Is valid ObjectId:', isValidObjectId);
        
        const queryConditions = [
          { firstName: { $regex: new RegExp(userIdentifier.split(' ')[0], 'i') }, lastName: { $regex: new RegExp(userIdentifier.split(' ')[1] || '', 'i') } },
          { firstName: { $regex: new RegExp(userIdentifier, 'i') } },
          { lastName: { $regex: new RegExp(userIdentifier, 'i') } }
        ];
        
        // Only add ObjectId condition if it's a valid ObjectId
        if (isValidObjectId) {
          queryConditions.push({ _id: userIdentifier });
        }
        
        console.log('[TEMPLATE SERVICE] Query conditions:', queryConditions);
        
        // Race between the query and timeout
        const user = await Promise.race([
          User.findOne({
            $or: queryConditions
          }),
          timeoutPromise
        ]);
        
        if (user) {
          console.log('[TEMPLATE SERVICE] Found user:', user.firstName, user.lastName);
          console.log('[TEMPLATE SERVICE] User signature exists:', !!user.signature);
          console.log('[TEMPLATE SERVICE] User licences:', user.licences?.length || 0);
          
          // Get user's signature
          if (user.signature) {
            userSignature = user.signature;
            console.log('[TEMPLATE SERVICE] Signature length:', userSignature.length);
          }
          
          // Find the Asbestos Assessor licence
          if (user.licences && user.licences.length > 0) {
            console.log('[TEMPLATE SERVICE] Available licences:', user.licences.map(l => ({ type: l.licenceType, number: l.licenceNumber })));
            
            const asbestosAssessorLicence = user.licences.find(licence => 
              licence.licenceType === 'Asbestos Assessor' || 
              licence.licenceType === 'LAA'
            );
            
            if (asbestosAssessorLicence) {
              laaLicenceNumber = asbestosAssessorLicence.licenceNumber;
              console.log('[TEMPLATE SERVICE] Found licence:', laaLicenceNumber);
            }
          }
          
          // Cache the user data for future lookups
          userLookupCache.set(userIdentifier, {
            licenceNumber: laaLicenceNumber,
            signature: userSignature
          });
          console.log('[TEMPLATE SERVICE] Cached user data for:', userIdentifier);
        } else {
          console.log('[TEMPLATE SERVICE] No user found for identifier:', userIdentifier);
        }
      } catch (error) {
        console.error('Error looking up user licence and signature:', error);
        // Continue with default values if lookup fails
        console.log('[TEMPLATE SERVICE] Using default values due to lookup error');
      }
    }
  }
  
  const replacements = {
    '{CLIENT_NAME}': data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '[CLIENT_NAME]': data.projectId?.client?.name || data.project?.client?.name || data.clientName || 'Unknown Client',
    '{ASBESTOS_TYPE}': data.clearanceType?.toLowerCase() || 'non-friable',
    '{SITE_NAME}': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '[SITE_NAME]': data.projectId?.name || data.project?.name || data.siteName || 'Unknown Site',
    '{ASBESTOS_REMOVALIST}': data.asbestosRemovalist || 'Unknown Removalist',
    '{LAA_NAME}': data.LAA || data.laaName || 'Unknown LAA',
    '[LAA_NAME]': data.LAA || data.laaName || 'Unknown LAA',
    '{LAA_LICENSE}': laaLicenceNumber,
    '[LAA_LICENCE]': laaLicenceNumber,
    '{ASSESSMENT_DATE}': data.assessmentDate 
      ? new Date(data.assessmentDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '{ASSESSMENT_SCOPE_BULLETS}': data.assessmentScopeBullets || '<li>No areas specified</li>',
    '{IDENTIFIED_ASBESTOS_ITEMS}': data.identifiedAsbestosItems || '<li>No asbestos-containing materials identified</li>',
    '[IDENTIFIED_ASBESTOS_ITEMS]': data.identifiedAsbestosItems || '<li>No asbestos-containing materials identified</li>',
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
    '[SIGNATURE_IMAGE]': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '{AUTHOR_NAME}': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Author',
    '[AUTHOR_NAME]': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Author',
    '{JOB_REFERENCE}': data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
    '[JOB_REFERENCE]': data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
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
    '[APPENDIX_REFERENCES]': (() => {
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

  // Convert line breaks to HTML, but handle multiple consecutive line breaks better
  result = result.replace(/\r?\n/g, '<br>');
  
  // Remove excessive line breaks (more than 2 consecutive <br> tags)
  result = result.replace(/(<br>\s*){3,}/g, '<br><br>');
  
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
  
  // Convert [UNDERLINE]text[/UNDERLINE] to underlined text
  result = result.replace(/\[UNDERLINE\](.*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  
  // Convert [BR] to line breaks
  result = result.replace(/\[BR\]/g, '<br>');

  return result;
};

module.exports = {
  getTemplateByType,
  replacePlaceholders,
  clearUserLookupCache
}; 