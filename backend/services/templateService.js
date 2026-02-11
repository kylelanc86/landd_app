const ReportTemplate = require('../models/ReportTemplate');
const mongoose = require('mongoose');
const { generateRiskAssessmentTable } = require('../models/assessmentTemplates/RiskAssessmentTable');

// Simple in-memory cache for user lookups during PDF generation
const userLookupCache = new Map();

// Date formatting function for clearance dates (dd Month yyyy format)
const formatClearanceDate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  // Use non-breaking space between day and month to keep them on the same line
  return `${day}\u00A0${month} ${year}`;
};

// Function to get default template content for a given template type
const getDefaultTemplateContent = (templateType) => {
  const defaultTemplates = {
    asbestosClearanceFriable: {
      standardSections: {
        backgroundInformationContent: "Asbestos is a naturally occurring mineral that was widely used in building materials until the late 1980s. When asbestos-containing materials (ACMs) are disturbed, they can release asbestos fibres into the air, which, if inhaled, can cause serious health problems including lung cancer, mesothelioma, and asbestosis. [BR][BR]\n\nFriable asbestos materials are those that can be easily crumbled, pulverised, or reduced to powder by hand pressure when dry. These materials pose the highest risk as they can easily release asbestos fibres into the air. [BR][BR]\n\nThis clearance inspection was conducted following the removal of friable asbestos-containing materials from the site to ensure that the area is safe for re-occupation.",
        legislativeRequirementsContent: "The clearance inspection was conducted in accordance with the following legislative requirements: [BR][BR]\n\n• Work Health and Safety Act 2011 (Cth) and associated Regulations [BR]\n• Work Health and Safety (Asbestos) Regulations 2011 [BR]\n• Australian Standard AS 4964-2004: Method for the qualitative identification of asbestos in bulk samples [BR]\n• Australian Standard AS 4964-2004: Method for the qualitative identification of asbestos in bulk samples [BR]\n• Code of Practice: How to Safely Remove Asbestos [BR][BR]\n\nThese regulations require that a licensed asbestos assessor conduct a clearance inspection following the removal of friable asbestos to ensure the area is safe for re-occupation.",
        clearanceCertificateLimitationsContent: "This clearance certificate is subject to the following limitations: [BR][BR]\n\n• The clearance inspection was conducted on the date specified and may not reflect conditions at other times [BR]\n• The inspection was limited to the areas specified in the scope of works [BR]\n• Future disturbance of remaining asbestos-containing materials may require additional clearance inspections [BR]\n• This certificate does not cover any asbestos-containing materials that were not part of the removal works [BR][BR]\n\nAny future work that may disturb asbestos-containing materials should be conducted by licensed asbestos removalists in accordance with applicable regulations.",
        inspectionExclusionsContent: "The following areas were excluded from this clearance inspection: [BR][BR]\n\n• Areas not accessible due to structural constraints [BR]\n• Areas where access was restricted for safety reasons [BR]\n• Areas outside the scope of the asbestos removal works [BR][BR]\n\nThese exclusions do not affect the validity of the clearance for the areas that were inspected."
      }
    },
    asbestosClearanceNonFriable: {
      standardSections: {
        backgroundInformationContent: "Asbestos is a naturally occurring mineral that was widely used in building materials until the late 1980s. When asbestos-containing materials (ACMs) are disturbed, they can release asbestos fibres into the air, which, if inhaled, can cause serious health problems including lung cancer, mesothelioma, and asbestosis. [BR][BR]\n\nNon-friable asbestos materials are those that are bonded with other materials such as cement, resin, or bitumen, making them less likely to release fibres unless significantly disturbed. However, these materials can still pose a risk if damaged or deteriorated. [BR][BR]\n\nThis clearance inspection was conducted following the removal of non-friable asbestos-containing materials from the site to ensure that the area is safe for re-occupation.",
        legislativeRequirementsContent: "The clearance inspection was conducted in accordance with the following legislative requirements: [BR][BR]\n\n• Work Health and Safety Act 2011 (Cth) and associated Regulations [BR]\n• Work Health and Safety (Asbestos) Regulations 2011 [BR]\n• Australian Standard AS 4964-2004: Method for the qualitative identification of asbestos in bulk samples [BR]\n• Code of Practice: How to Safely Remove Asbestos [BR][BR]\n\nThese regulations require that a licensed asbestos assessor conduct a clearance inspection following the removal of asbestos to ensure the area is safe for re-occupation.",
        clearanceCertificateLimitationsContent: "This clearance certificate is subject to the following limitations: [BR][BR]\n\n• The clearance inspection was conducted on the date specified and may not reflect conditions at other times [BR]\n• The inspection was limited to the areas specified in the scope of works [BR]\n• Future disturbance of remaining asbestos-containing materials may require additional clearance inspections [BR]\n• This certificate does not cover any asbestos-containing materials that were not part of the removal works [BR][BR]\n\nAny future work that may disturb asbestos-containing materials should be conducted by licensed asbestos removalists in accordance with applicable regulations.",
        inspectionExclusionsContent: "The following areas were excluded from this clearance inspection: [BR][BR]\n\n• Areas not accessible due to structural constraints [BR]\n• Areas where access was restricted for safety reasons [BR]\n• Areas outside the scope of the asbestos removal works [BR][BR]\n\nThese exclusions do not affect the validity of the clearance for the areas that were inspected."
      }
    }
  };
  
  return defaultTemplates[templateType] || null;
};

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
    console.log(`[TEMPLATE SERVICE] getTemplateByType called with: ${templateType}`);
    let template = null;
    
    // Add timeout to prevent hanging database queries
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Template lookup timeout')), 10000); // 10 second timeout
    });
    
    // Race between the database query and timeout
    const templateQuery = async () => {
      if (templateType === "asbestosClearanceComplex") {
        console.log(`[TEMPLATE SERVICE] Complex template type, returning null`);
        return null; // Complex type doesn't use default templates
      } else {
        console.log(`[TEMPLATE SERVICE] Querying database for template type: ${templateType}`);
        const result = await ReportTemplate.findOne({ templateType });
        console.log(`[TEMPLATE SERVICE] Database query result:`, result ? 'Found' : 'Not found');
        return result;
      }
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
      } else if (templateType === "asbestosClearanceFriableNonFriableConditions") {
        title = "FRIABLE (NON-FRIABLE CONDITIONS) ASBESTOS REMOVAL CLEARANCE CERTIFICATE";
      } else if (templateType === "asbestosClearanceVehicle") {
        title = "ASBESTOS INSPECTION CERTIFICATE";
      } else if (templateType === "asbestosClearanceComplex") {
        title = "COMPLEX ASBESTOS REMOVAL CLEARANCE CERTIFICATE";
      } else if (templateType === "asbestosAssessment") {
        title = "ASBESTOS MATERIAL ASSESSMENT REPORT";
      } else if (templateType === "residentialAsbestosAssessment") {
        title = "RESIDENTIAL ASBESTOS MATERIAL ASSESSMENT REPORT";
      }
      
      // Create default template if it doesn't exist
      let standardSections = {};
      
      if (templateType === "asbestosAssessment") {
        // Asbestos assessment content - use placeholders like clearance templates
        standardSections = {
          introductionTitle: "INTRODUCTION",
          introductionContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          surveyFindingsTitle: "SUMMARY OF IDENTIFIED ACM",
          surveyFindingsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          surveyFindingsContentNoSamples: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          discussionTitle: "DISCUSSION AND CONCLUSIONS",
          discussionContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          recommendedControlMeasuresTitle: "RECOMMENDED CONTROL MEASURES",
          recommendedControlMeasuresContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          assessmentMethodologyTitle: "ASSESSMENT METHODOLOGY",
          assessmentMethodologyContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          riskAssessmentTitle: "RISK ASSESSMENT",
          riskAssessmentContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          controlMeasuresTitle: "DETERMINING SUITABLE CONTROL MEASURES",
          controlMeasuresContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          remediationRequirementsTitle: "REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM",
          remediationRequirementsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          legislationTitle: "LEGISLATION",
          legislationContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          assessmentLimitationsTitle: "ASSESSMENT LIMITATIONS/CAVEATS",
          assessmentLimitationsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          signOffContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          signaturePlaceholder: "[DYNAMIC_CONTENT_NOT_LOADED]",
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Assessment Report"
          },
          standardSections
        });
      } else if (templateType === "residentialAsbestosAssessment") {
        // Residential asbestos assessment: includes Background section, "Summary of Identified ACM" instead of Survey Findings
        standardSections = {
          backgroundTitle: "BACKGROUND",
          backgroundContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          introductionTitle: "INTRODUCTION",
          introductionContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          surveyFindingsTitle: "SUMMARY OF IDENTIFIED ACM",
          surveyFindingsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          surveyFindingsContentNoSamples: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          discussionTitle: "DISCUSSION AND CONCLUSIONS",
          discussionContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          recommendedControlMeasuresTitle: "RECOMMENDED CONTROL MEASURES",
          recommendedControlMeasuresContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          assessmentMethodologyTitle: "ASSESSMENT METHODOLOGY",
          assessmentMethodologyContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          riskAssessmentTitle: "RISK ASSESSMENT",
          riskAssessmentContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          controlMeasuresTitle: "DETERMINING SUITABLE CONTROL MEASURES",
          controlMeasuresContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          remediationRequirementsTitle: "REQUIREMENTS FOR REMEDIATION/REMOVAL WORKS INVOLVING ACM",
          remediationRequirementsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          legislationTitle: "LEGISLATION",
          legislationContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          assessmentLimitationsTitle: "ASSESSMENT LIMITATIONS/CAVEATS",
          assessmentLimitationsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          signOffContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          signaturePlaceholder: "[DYNAMIC_CONTENT_NOT_LOADED]",
        };
        
        template = new ReportTemplate({
          templateType,
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
          backgroundInformationContent: "A friable asbestos clearance inspection is a critical component of the asbestos removal process, ensuring that all asbestos-containing materials have been properly removed and the area is safe for re-occupation. This inspection is conducted by a Licensed Asbestos Assessor (LAA) in accordance with the Work Health and Safety Act 2011 and the Work Health and Safety Regulation 2011.\n\nThe clearance inspection involves a thorough visual examination of the asbestos removal area and surrounding areas to ensure no visible asbestos residue remains. This process is essential to protect the health and safety of workers and occupants who will re-enter the area following asbestos removal works.",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "The clearance inspection is conducted in accordance with the following legislative requirements:\n\n• Work Health and Safety Act 2011 (Cth)\n• Work Health and Safety Regulation 2011 (Cth)\n• Code of Practice: How to Safely Remove Asbestos (Safe Work Australia)\n• Code of Practice: How to Manage and Control Asbestos in the Workplace (Safe Work Australia)\n\nThese regulations require that a Licensed Asbestos Assessor conduct a clearance inspection following the removal of friable asbestos to ensure the area is safe for re-occupation.",
          
          friableClearanceCertificateLimitationsTitle: "FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          friableClearanceCertificateLimitationsContent: "This clearance certificate is subject to the following limitations:\n\n• The inspection is limited to the areas specified in the asbestos removal plan\n• The clearance is based on visual inspection only and does not include air monitoring unless specifically requested\n• The certificate is valid only for the specific asbestos removal works described in this report\n• Any subsequent modifications to the area may invalidate this clearance certificate\n• The clearance does not cover areas not accessible during the inspection",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection {AIR_MONITORING_REFERENCE} following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "The following areas were excluded from this clearance inspection:\n\n• Areas not specified in the asbestos removal plan\n• Areas that were not accessible during the inspection\n• Areas outside the designated asbestos removal zone\n• Any areas that were not part of the original asbestos removal scope\n\n{JOB_SPECIFIC_EXCLUSIONS}",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\n{AIR_MONITORING_RESULTS}\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      } else if (templateType === "asbestosClearanceFriableNonFriableConditions") {
        // Friable (Non-Friable Conditions) clearance content
        standardSections = {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING FRIABLE (NON-FRIABLE CONDITIONS) CLEARANCE INSPECTIONS",
          backgroundInformationContent: "A friable (non-friable conditions) asbestos clearance inspection is conducted when friable asbestos has been removed from a site, but under non-friable conditions and lower risk circumstances. This inspection ensures that all asbestos materials have been properly removed and the area is safe for re-occupation. The inspection is conducted by a Licensed Asbestos Assessor (LAA) in accordance with the Work Health and Safety Act 2011 and the Work Health and Safety Regulation 2011.\n\nThis clearance type is applicable when friable asbestos has been removed but the work was conducted under controlled conditions that did not require the same level of containment as standard friable asbestos removal.",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "The clearance inspection is conducted in accordance with the following legislative requirements:\n\n• Work Health and Safety Act 2011 (Cth)\n• Work Health and Safety Regulation 2011 (Cth)\n• Code of Practice: How to Safely Remove Asbestos (Safe Work Australia)\n• Code of Practice: How to Manage and Control Asbestos in the Workplace (Safe Work Australia)\n\nThese regulations require that a Licensed Asbestos Assessor conduct a clearance inspection following the removal of asbestos to ensure the area is safe for re-occupation.",
          
          friableNonFriableConditionsCertificateLimitationsTitle: "CLEARANCE CERTIFICATE LIMITATIONS",
          friableNonFriableConditionsCertificateLimitationsContent: "This clearance certificate is subject to the following limitations:\n\n• The inspection is limited to the areas specified in the asbestos removal plan\n• The clearance is based on visual inspection only and does not include air monitoring unless specifically requested\n• The certificate is valid only for the specific asbestos removal works described in this report\n• Any subsequent modifications to the area may invalidate this clearance certificate\n• The clearance does not cover areas not accessible during the inspection\n• The certificate covers friable asbestos removal conducted under non-friable conditions",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection {AIR_MONITORING_REFERENCE} following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "The following areas were excluded from this clearance inspection:\n\n• Areas not specified in the asbestos removal plan\n• Areas that were not accessible during the inspection\n• Areas outside the designated asbestos removal zone\n• Any areas that were not part of the original asbestos removal scope\n\n{JOB_SPECIFIC_EXCLUSIONS}",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\n{AIR_MONITORING_RESULTS}\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      } else if (templateType === "asbestosClearanceVehicle") {
        // Vehicle/Equipment clearance content
        standardSections = {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING VEHICLE/EQUIPMENT ASBESTOS CLEARANCE INSPECTIONS",
          backgroundInformationContent: "A vehicle/equipment asbestos clearance inspection is conducted following the removal of asbestos-containing materials from vehicles or equipment to ensure that all asbestos materials have been properly removed and the vehicle or equipment is safe for use. This inspection is conducted by a Licensed Asbestos Assessor (LAA) in accordance with the Work Health and Safety Act 2011 and the Work Health and Safety Regulation 2011.\n\nVehicles and equipment contaminated with asbestos require thorough decontamination and clearance inspection before they can be safely used. This process ensures that no asbestos fibres remain in the vehicle or equipment that could pose a risk to operators or occupants.",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "The clearance inspection is conducted in accordance with the following legislative requirements:\n\n• Work Health and Safety Act 2011 (Cth)\n• Work Health and Safety Regulation 2011 (Cth)\n• Code of Practice: How to Safely Remove Asbestos (Safe Work Australia)\n• Code of Practice: How to Manage and Control Asbestos in the Workplace (Safe Work Australia)\n\nThese regulations require that a Licensed Asbestos Assessor conduct a clearance inspection following the removal of asbestos from vehicles or equipment to ensure they are safe for use.",
          
          vehicleCertificateLimitationsTitle: "VEHICLE/EQUIPMENT ASBESTOS CLEARANCE CERTIFICATE LIMITATIONS",
          vehicleCertificateLimitationsContent: "This clearance certificate is subject to the following limitations:\n\n• The inspection is limited to the vehicle/equipment and areas specified in the asbestos removal plan\n• The clearance is based on visual inspection only and does not include air monitoring unless specifically requested\n• The certificate is valid only for the specific asbestos removal works described in this report\n• Any subsequent modifications or additional contamination may invalidate this clearance certificate\n• The clearance does not cover areas of the vehicle/equipment not accessible during the inspection\n• The certificate specifically covers vehicle/equipment asbestos removal works only",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection {AIR_MONITORING_REFERENCE} following the removal of {ASBESTOS_TYPE} asbestos from the vehicle/equipment (herein referred to as 'the Vehicle/Equipment').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D conducted the inspection at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "The following areas were excluded from this clearance inspection:\n\n• Areas of the vehicle/equipment not accessible during the inspection\n• Areas where access was restricted for safety reasons\n• Areas outside the designated asbestos removal zone\n• Any areas that were not part of the original asbestos removal scope\n\n{JOB_SPECIFIC_EXCLUSIONS}",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the vehicle/equipment and the surrounding areas was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the inspected areas of the vehicle/equipment.\n\n{AIR_MONITORING_RESULTS}\n\nThe LAA considers that the vehicle/equipment does not pose a risk to health and safety from exposure to asbestos and may be returned to service.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      } else if (templateType === "asbestosClearanceComplex") {
        // Complex clearance content - minimal template since it doesn't use default content
        standardSections = {
          note: "This is a Complex Clearance Certificate that requires custom content generation. The standard template content system is not used for this clearance type.",
          customSections: [
            "Project-specific requirements",
            "Specialist methodology", 
            "Custom assessment criteria",
            "Project-specific conclusions",
            "Specialist recommendations"
          ]
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Specialist Clearance Certificate"
          },
          standardSections
        });
      } else {
        // Non-friable clearance content
        standardSections = {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING NON-FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "A non-friable asbestos clearance inspection is conducted following the removal of non-friable asbestos-containing materials to ensure that all asbestos materials have been properly removed and the area is safe for re-occupation. This inspection is conducted by a Licensed Asbestos Assessor (LAA) in accordance with the Work Health and Safety Act 2011 and the Work Health and Safety Regulation 2011.\n\nNon-friable asbestos materials are those that are bonded in a matrix and are less likely to release asbestos fibres during normal use. However, clearance inspection is still required to ensure proper removal and to protect the health and safety of workers and occupants who will re-enter the area following asbestos removal works.",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "The clearance inspection is conducted in accordance with the following legislative requirements:\n\n• Work Health and Safety Act 2011 (Cth)\n• Work Health and Safety Regulation 2011 (Cth)\n• Code of Practice: How to Safely Remove Asbestos (Safe Work Australia)\n• Code of Practice: How to Manage and Control Asbestos in the Workplace (Safe Work Australia)\n\nThese regulations require that a Licensed Asbestos Assessor conduct a clearance inspection following the removal of non-friable asbestos to ensure the area is safe for re-occupation.",
          
          nonFriableClearanceCertificateLimitationsTitle: "NON-FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          nonFriableClearanceCertificateLimitationsContent: "This clearance certificate is subject to the following limitations:\n\n• The inspection is limited to the areas specified in the asbestos removal plan\n• The clearance is based on visual inspection only and does not include air monitoring unless specifically requested\n• The certificate is valid only for the specific asbestos removal works described in this report\n• Any subsequent modifications to the area may invalidate this clearance certificate\n• The clearance does not cover areas not accessible during the inspection\n• The certificate specifically covers non-friable asbestos removal works only",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "The following areas were excluded from this clearance inspection:\n\n• Areas not specified in the asbestos removal plan\n• Areas that were not accessible during the inspection\n• Areas outside the designated asbestos removal zone\n• Any areas that were not part of the original asbestos removal scope\n\n{JOB_SPECIFIC_EXCLUSIONS}",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
        };
        
        template = new ReportTemplate({
          templateType,
          createdBy,
          reportHeaders: {
            title: title,
            subtitle: "Clearance Inspection Report"
          },
          standardSections
        });
      }
      
      console.log(`About to save template for type: ${templateType}`);
      console.log('Template standardSections before save:', template.standardSections);
      console.log('Background information content before save:', template.standardSections?.backgroundInformationContent);
      
      await template.save();
      
      console.log(`Template saved for type: ${templateType}`);
      console.log('Template standardSections after save:', template.standardSections);
      console.log('Template standardSections keys:', Object.keys(template.standardSections || {}));
      console.log('Background information content after save:', template.standardSections?.backgroundInformationContent);
      return template;
    }
            console.log(`Template found/created for type: ${templateType}`);
            console.log('Template standardSections:', template?.standardSections);
            console.log('Template standardSections keys:', Object.keys(template?.standardSections || {}));
            console.log('Background information content exists:', !!template?.standardSections?.backgroundInformationContent);
            
            // Check if template is missing content and update it
            if (template && template.standardSections) {
              const needsUpdate = !template.standardSections.backgroundInformationContent || 
                                 !template.standardSections.legislativeRequirementsContent ||
                                 !template.standardSections.inspectionExclusionsContent ||
                                 !template.standardSections.clearanceCertificationContent ||
                                 !template.standardSections.nonFriableClearanceCertificateLimitationsContent;
              
              if (needsUpdate) {
                console.log(`Template missing content, updating with default content for type: ${templateType}`);
                
                // Get the default content for this template type
                const defaultContent = getDefaultTemplateContent(templateType);
                if (defaultContent) {
                  // Update the template with missing content
                  Object.keys(defaultContent.standardSections).forEach(key => {
                    if (!template.standardSections[key] || template.standardSections[key] === '') {
                      template.standardSections[key] = defaultContent.standardSections[key];
                      console.log(`Updated ${key} with default content`);
                    }
                  });
                  
                  // Save the updated template
                  await template.save();
                  console.log(`Template updated and saved for type: ${templateType}`);
                }
              }
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
  
  // Look up user's Asbestos Assessor licence number, state, and signature
  let laaLicenceNumber = 'AA00031'; // Default fallback
  let laaLicenceState = ''; // Default fallback
  let userSignature = null;
  // ALWAYS use data.LAA for the name (not createdBy)
  let laaName = data.LAA || data.laaName || 'Unknown LAA'; // Default name
  
  // Look up the user identified by data.LAA to get their licence information
  // data.LAA is a name string (e.g., "FirstName LastName")
  let userIdentifier = null;
  
  // PRIORITY 1: Use data.LAA for clearance certificates
  if (data.LAA) {
    userIdentifier = data.LAA;
    console.log('[TEMPLATE SERVICE] Using data.LAA for lookup:', userIdentifier);
  } else if (data.assessorId) {
    // Fall back to assessorId for assessment reports
    userIdentifier = data.assessorId;
    
    // Handle assessorId object structure for assessments
    if (typeof data.assessorId === 'object') {
      userIdentifier = data.assessorId.firstName + ' ' + data.assessorId.lastName;
    }
    console.log('[TEMPLATE SERVICE] Using data.assessorId for lookup:', userIdentifier);
  }
  
  if (userIdentifier) {
    // Check cache first
    if (userLookupCache.has(userIdentifier)) {
      const cachedUser = userLookupCache.get(userIdentifier);
      console.log('[TEMPLATE SERVICE] Using cached user data for:', userIdentifier);
      // Keep laaName as data.LAA (don't override with cached name)
      laaLicenceNumber = cachedUser.licenceNumber;
      laaLicenceState = cachedUser.licenceState || '';
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
        
        let queryConditions = [];
        
        // If it's a valid ObjectId, prioritize direct ID lookup
        if (isValidObjectId) {
          queryConditions = [{ _id: userIdentifier }];
        } else {
          // Name-based lookup - split by space for first/last name
          const nameParts = userIdentifier.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            // Has first and last name
            queryConditions = [
              { firstName: { $regex: new RegExp(`^${nameParts[0]}$`, 'i') }, lastName: { $regex: new RegExp(`^${nameParts.slice(1).join(' ')}$`, 'i') } },
              { firstName: { $regex: new RegExp(nameParts[0], 'i') }, lastName: { $regex: new RegExp(nameParts[1], 'i') } }
            ];
          } else {
            // Single name - try first or last name
            queryConditions = [
              { firstName: { $regex: new RegExp(userIdentifier, 'i') } },
              { lastName: { $regex: new RegExp(userIdentifier, 'i') } }
            ];
          }
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
          
          // Keep laaName as data.LAA (don't override with database name)
          // Only update if data.LAA was not provided
          if (!data.LAA && !data.laaName) {
            laaName = `${user.firstName} ${user.lastName}`;
          }
          
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
              laaLicenceState = asbestosAssessorLicence.state || '';
              console.log('[TEMPLATE SERVICE] Found licence:', laaLicenceNumber, 'State:', laaLicenceState);
            }
          }
          
          // Cache the user data for future lookups
          // Cache by the identifier used (ID or name) for direct lookups
          userLookupCache.set(userIdentifier, {
            name: laaName, // Store the name from data.LAA, not the database name
            licenceNumber: laaLicenceNumber,
            licenceState: laaLicenceState,
            signature: userSignature
          });
          console.log('[TEMPLATE SERVICE] Cached user data for:', userIdentifier);
          
          // Also cache by user ID and database name for backward compatibility
          if (user._id) {
            const userIdString = user._id.toString();
            if (userIdString !== userIdentifier) {
              userLookupCache.set(userIdString, {
                name: laaName,
                licenceNumber: laaLicenceNumber,
                licenceState: laaLicenceState,
                signature: userSignature
              });
              console.log('[TEMPLATE SERVICE] Also cached user data by ID:', userIdString);
            }
          }
          const dbUserName = `${user.firstName} ${user.lastName}`;
          if (dbUserName && dbUserName !== userIdentifier && dbUserName !== 'Unknown LAA') {
            userLookupCache.set(dbUserName, {
              name: laaName,
              licenceNumber: laaLicenceNumber,
              licenceState: laaLicenceState,
              signature: userSignature
            });
            console.log('[TEMPLATE SERVICE] Also cached user data by database name:', dbUserName);
          }
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
    '{LAA_NAME}': laaName,
    '[LAA_NAME]': laaName,
    '{LAA_LICENSE}': laaLicenceNumber,
    '[LAA_LICENCE]': laaLicenceNumber,
    '{LAA_LICENCE_STATE}': laaLicenceState,
    '[LAA_LICENCE_STATE]': laaLicenceState,
    '{ASSESSMENT_DATE}': data.assessmentDate
      ? new Date(data.assessmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
      : 'Unknown Date',
    '{ASSESSMENT_SCOPE_BULLETS}': data.assessmentScopeBullets || '<li>No areas specified</li>',
    '{ASSESSMENT_SCOPE}': (() => {
      // Custom placeholder for assessment scope - will be defined at a later date
      // Returns empty string for now, but will format as bullet list when implemented
      if (data.assessmentScope && Array.isArray(data.assessmentScope) && data.assessmentScope.length > 0) {
        return data.assessmentScope.map(item => {
          const text = typeof item === 'string' ? item : (item.text || item.name || '');
          return `[BULLET]${text}`;
        }).join('\n');
      }
      return ''; // Return empty for now until defined
    })(),
    '[ASSESSMENT_SCOPE]': (() => {
      // Custom placeholder for assessment scope - will be defined at a later date
      // Returns empty string for now, but will format as bullet list when implemented
      if (data.assessmentScope && Array.isArray(data.assessmentScope) && data.assessmentScope.length > 0) {
        return data.assessmentScope.map(item => {
          const text = typeof item === 'string' ? item : (item.text || item.name || '');
          return `[BULLET]${text}`;
        }).join('\n');
      }
      return ''; // Return empty for now until defined
    })(),
    '{IDENTIFIED_ASBESTOS_ITEMS}': data.identifiedAsbestosItems || '<ul class="bullet-list" style="margin: 0 0 8px 0; padding-left: 24px; list-style-position: outside;"><li style="padding-left: 20px;">No asbestos-containing materials identified</li></ul>',
    '[IDENTIFIED_ASBESTOS_ITEMS]': data.identifiedAsbestosItems || '<ul class="bullet-list" style="margin: 0 0 8px 0; padding-left: 24px; list-style-position: outside;"><li style="padding-left: 20px;">No asbestos-containing materials identified</li></ul>',
    '{RISK_ASSESSMENT_TABLE}': generateRiskAssessmentTable(),
    '[RISK_ASSESSMENT_TABLE]': generateRiskAssessmentTable(),
    '{STATE}': data.state || '',
    '[STATE]': data.state || '',
    '{INTRUSIVENESS}': (data.intrusiveness === 'intrusive' || 'non-intrusive'),
    '[INTRUSIVENESS]': (data.intrusiveness === 'intrusive' || 'non-intrusive'),
    '{REGULATOR}': (() => {
      const state = data.state;
      if (state === 'ACT') return 'Worksafe ACT';
      if (state === 'NSW') return 'Safework NSW';
      return '';
    })(),
    '[REGULATOR]': (() => {
      const state = data.state;
      if (state === 'ACT') return 'Worksafe ACT';
      if (state === 'NSW') return 'Safework NSW';
      return '';
    })(),
    '{STATE_SPECIFIC_REMOVAL_RECS}': (() => {
      const state = data.state;
      if (state === 'ACT' || state === 'Commonwealth') {
        return 'All asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022) and in accordance with EPA (2011) Contaminated Sites Information Sheet No. 5 \'Requirements for the Transport and Disposal of Asbestos Contaminated Wastes\' and Information Sheet No.6 \'Management of Small Scale, Low Risk Soil Asbestos Contamination\'.';
      }
      if (state === 'NSW') {
        return 'All asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022).';
      }
      return '';
    })(),
    '[STATE_SPECIFIC_REMOVAL_RECS]': (() => {
      const state = data.state;
      if (state === 'ACT' || state === 'Commonwealth') {
        return 'All asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022) and in accordance with EPA (2011) Contaminated Sites Information Sheet No. 5 \'Requirements for the Transport and Disposal of Asbestos Contaminated Wastes\' and Information Sheet No.6 \'Management of Small Scale, Low Risk Soil Asbestos Contamination\'.';
      }
      if (state === 'NSW') {
        return 'All asbestos removal must be undertaken as per the Work Health and Safety: How to Safely Remove Asbestos Code of Practice (2022).';
      }
      return '';
    })(),
    '{10m2_RULE}': (() => {
      const state = data.state || (data.jurisdiction && data.jurisdiction !== 'ACT' ? data.jurisdiction : undefined);
      if (state === 'NSW') {
        return 'In NSW, under the Work Health and Safety Regulations, an employer or self-employed person can conduct the removal of up to 10 square metres of non-friable ACM. Such works must still abide by the requirements set out in Code of Practice - How to safely remove asbestos.';
      }
      return '';
    })(),
    '[10m2_RULE]': (() => {
      const state = data.state || (data.jurisdiction && data.jurisdiction !== 'ACT' ? data.jurisdiction : undefined);
      if (state === 'NSW') {
        return 'In NSW, under the Work Health and Safety Regulations, an employer or self-employed person can conduct the removal of up to 10 square metres of non-friable ACM. Such works must still abide by the requirements set out in Code of Practice - How to safely remove asbestos.';
      }
      return '';
    })(),
    '{INSPECTION_TIME}': (() => {
      if (data.inspectionTime) {
        const trimmedTime = data.inspectionTime.trim();
        
        // If it already has AM/PM, return as-is (preserve the original format)
        if (trimmedTime.match(/\s*(AM|PM|am|pm)\s*$/i)) {
          return trimmedTime;
        }
        
        // If it's in 24-hour format (HH:MM), convert to 12-hour format with AM/PM
        const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2];
          const ampm = hours >= 12 ? 'PM' : 'AM';
          
          // Convert to 12-hour format
          if (hours === 0) {
            hours = 12; // Midnight
          } else if (hours > 12) {
            hours = hours - 12; // Afternoon/evening
          }
          
          return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        }
        // If format doesn't match, return the original (might be invalid format)
        return trimmedTime;
      }
      return 'Inspection Time';
    })(),
    '[INSPECTION_TIME]': (() => {
      if (data.inspectionTime) {
        const trimmedTime = data.inspectionTime.trim();
        
        // If it already has AM/PM, return as-is (preserve the original format)
        if (trimmedTime.match(/\s*(AM|PM|am|pm)\s*$/i)) {
          return trimmedTime;
        }
        
        // If it's in 24-hour format (HH:MM), convert to 12-hour format with AM/PM
        const timeMatch = trimmedTime.match(/^(\d{1,2}):(\d{2})$/);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const minutes = timeMatch[2];
          const ampm = hours >= 12 ? 'PM' : 'AM';
          
          // Convert to 12-hour format
          if (hours === 0) {
            hours = 12; // Midnight
          } else if (hours > 12) {
            hours = hours - 12; // Afternoon/evening
          }
          
          return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
        }
        // If format doesn't match, return the original (might be invalid format)
        return trimmedTime;
      }
      return 'Inspection Time';
    })(),
    '{INSPECTION_DATE}': data.clearanceDate 
      ? new Date(data.clearanceDate).toLocaleDateString('en-GB')
      : 'Unknown Date',
    '{REPORT_TYPE}': data.clearanceType || 'Non-friable',
    '{CLEARANCE_DATE}': formatClearanceDate(data.clearanceDate),
    '{CLEARANCE_TIME}': 'Clearance Time',
    '{PROJECT_NAME}': data.projectId?.name || data.project?.name || 'Unknown Project',
    '{PROJECT_NUMBER}': data.projectId?.projectID || data.project?.projectID || 'Unknown Project ID',
    '{SITE_ADDRESS}': data.projectId?.name || data.project?.name || 'Unknown Address',
    '{SIGNATURE_IMAGE}': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '[SIGNATURE_IMAGE]': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '{SIGNATURE_PLACEHOLDER}': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '[SIGNATURE_PLACEHOLDER]': userSignature ? `<img src="${userSignature}" alt="Signature" style="max-width: 150px; max-height: 75px;" />` : '[SIGNATURE_PLACEHOLDER]',
    '{AUTHOR_NAME}': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Author',
    '[AUTHOR_NAME]': data.assessorId?.firstName + ' ' + data.assessorId?.lastName || data.LAA || 'Unknown Author',
    '{JOB_REFERENCE}': data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
    '[JOB_REFERENCE]': data.projectId?.projectID || data.project?.projectID || 'Unknown Reference',
    '{VEHICLE_DESCRIPTION}': data.vehicleEquipmentDescription || 'Vehicle/Equipment',
    '[VEHICLE_DESCRIPTION]': data.vehicleEquipmentDescription || 'Vehicle/Equipment',
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
    '{AIR_MONITORING_RESULTS}': data.airMonitoring ? `Air monitoring was conducted and results were below the clearance indicator of 0.01 fibres per mL.` : '',
    '{JOB_SPECIFIC_EXCLUSIONS}': data.jobSpecificExclusions ? data.jobSpecificExclusions : '',
    '{LEGISLATION}': (() => {
      if (data.selectedLegislation && Array.isArray(data.selectedLegislation) && data.selectedLegislation.length > 0) {
        // Filter legislation based on clearance jurisdiction if available
        let filteredLegislation = data.selectedLegislation;
        if (data.jurisdiction) {
          filteredLegislation = data.selectedLegislation.filter(item => 
            item.jurisdiction === data.jurisdiction
          );
        }
        
        if (filteredLegislation.length > 0) {
          return filteredLegislation.map(item => {
            const title = item.legislationTitle || item.text || 'Unknown Legislation';
            return `[BULLET]${title}`;
          }).join('\n');
        }
      }
      return '[BULLET]No legislation items selected';
    })(),
    '[LEGISLATION]': (() => {
      if (data.selectedLegislation && Array.isArray(data.selectedLegislation) && data.selectedLegislation.length > 0) {
        // Filter legislation based on clearance jurisdiction if available
        let filteredLegislation = data.selectedLegislation;
        if (data.jurisdiction) {
          filteredLegislation = data.selectedLegislation.filter(item => 
            item.jurisdiction === data.jurisdiction
          );
        }
        
        if (filteredLegislation.length > 0) {
          return filteredLegislation.map(item => {
            const title = item.legislationTitle || item.text || 'Unknown Legislation';
            return `[BULLET]${title}`;
          }).join('\n');
        }
      }
      return '[BULLET]No legislation items selected';
    })()
  };

  let result = content;
  Object.entries(replacements).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  });

  // Convert [BR] to line breaks first
  result = result.replace(/\[BR\]/g, '<br>');
  result = result.replace(/\{BR\}/g, '<br>');
  
  // Convert natural line breaks to HTML
  result = result.replace(/\r?\n/g, '<br>');
  
  // Remove excessive line breaks (more than 2 consecutive <br> tags)
  result = result.replace(/(<br>\s*){3,}/g, '<br><br>');
  
  // Apply simple formatting
  // Process bullet points by splitting into lines and grouping consecutive [BULLET] lines
  // Each line break now creates a new paragraph
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
      // If we have accumulated bullets, create the ul element first
      if (currentBulletList.length > 0) {
        const bulletItems = currentBulletList.map(content => `<li>${content}</li>`).join('');
        processedLines.push(`<ul class="bullet-list">${bulletItems}</ul>`);
        currentBulletList = [];
        inBulletBlock = false;
      }
      // Each non-empty line becomes its own paragraph
      processedLines.push(`<div class="paragraph">${line}</div>`);
    }
  }
  
  // Handle any remaining bullets at the end
  if (currentBulletList.length > 0) {
    const bulletItems = currentBulletList.map(content => `<li>${content}</li>`).join('');
    processedLines.push(`<ul class="bullet-list">${bulletItems}</ul>`);
  }
  
  result = processedLines.join('');
  
  // Convert **text** to bold
  result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert [UNDERLINE]text[/UNDERLINE] to underlined text
  result = result.replace(/\[UNDERLINE\](.*?)\[\/UNDERLINE\]/g, '<u>$1</u>');
  
  // Remove HALF_BR placeholders - no longer needed
  result = result.replace(/\[HALF_BR\]/g, '');
  result = result.replace(/\{HALF_BR\}/g, '');

  return result;
};

module.exports = {
  getTemplateByType,
  replacePlaceholders,
  clearUserLookupCache
}; 