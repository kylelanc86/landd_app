const mongoose = require('mongoose');
const ReportTemplate = require('../models/ReportTemplate');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/air_monitoring', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkAndCreateTemplates() {
  try {
    console.log('Checking for existing templates...');
    
    // Check for non-friable template
    let nonFriableTemplate = await ReportTemplate.findOne({ templateType: 'asbestosClearanceNonFriable' });
    if (!nonFriableTemplate) {
      console.log('Creating non-friable template...');
      nonFriableTemplate = new ReportTemplate({
        templateType: 'asbestosClearanceNonFriable',
        createdBy: 'system',
        standardSections: {
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
      await nonFriableTemplate.save();
      console.log('Non-friable template created successfully');
    } else {
      console.log('Non-friable template already exists');
    }
    
    // Check for friable template
    let friableTemplate = await ReportTemplate.findOne({ templateType: 'asbestosClearanceFriable' });
    if (!friableTemplate) {
      console.log('Creating friable template...');
      friableTemplate = new ReportTemplate({
        templateType: 'asbestosClearanceFriable',
        createdBy: 'system',
        standardSections: {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "Following completion of friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:\n\nVisual inspection of the work area for asbestos dust or debris\nVisual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris\nAir monitoring to ensure fibre levels are below the clearance indicator of 0.01 fibres per mL\n\nIt is required that a Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:\n\nThis certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.\nThe asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination\nThe removal area does not pose a risk to health safety and safety from exposure to asbestos\nAir monitoring results are satisfactory",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "Friable Clearance Certificates should be written in general accordance with and with reference to:\n\nACT Work Health and Safety (WHS) Act 2011\nACT Work Health and Safety Regulation 2011\nACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022",
          
          friableClearanceCertificateLimitationsTitle: "FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          friableClearanceCertificateLimitationsContent: "The visual clearance inspection and air monitoring was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection and air monitoring following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. Photographs of the Asbestos Removal Area, Site Plan, and Air Monitoring Report are presented in Appendix A, Appendix B, and Appendix C respectively.",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nAir monitoring was conducted and results were satisfactory (below the recommended control limit of 0.01 fibres per mL).\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
        }
      });
      await friableTemplate.save();
      console.log('Friable template created successfully');
    } else {
      console.log('Friable template already exists');
    }
    
    console.log('Template check completed successfully');
    
  } catch (error) {
    console.error('Error checking/creating templates:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkAndCreateTemplates(); 