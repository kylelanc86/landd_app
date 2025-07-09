const mongoose = require('mongoose');
const NonFriableClearance = require('../models/NonFriableClearance');
const FriableClearance = require('../models/FriableClearance');

async function createDefaultTemplates() {
  try {
    await mongoose.connect('mongodb://localhost:27017/air_monitoring');
    console.log('Connected to MongoDB');

    // Check if templates already exist
    const existingNonFriable = await NonFriableClearance.findOne();
    const existingFriable = await FriableClearance.findOne();

    if (!existingNonFriable) {
      console.log('Creating Non-Friable template...');
      const nonFriableTemplate = new NonFriableClearance({
        createdBy: new mongoose.Types.ObjectId(), // Create a dummy ObjectId
        reportHeaders: {
          title: "Non-Friable Asbestos Clearance Certificate",
          subtitle: "Clearance Inspection Report"
        },
        standardSections: {
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
        }
      });
      
      await nonFriableTemplate.save();
      console.log('Non-Friable template created successfully');
    } else {
      console.log('Non-Friable template already exists');
    }

    if (!existingFriable) {
      console.log('Creating Friable template...');
      const friableTemplate = new FriableClearance({
        createdBy: new mongoose.Types.ObjectId(), // Create a dummy ObjectId
        reportHeaders: {
          title: "Friable Asbestos Clearance Certificate",
          subtitle: "Clearance Inspection Report"
        },
        standardSections: {
          backgroundInformationTitle: "BACKGROUND INFORMATION REGARDING FRIABLE CLEARANCE INSPECTIONS",
          backgroundInformationContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          legislativeRequirementsTitle: "LEGISLATIVE REQUIREMENTS",
          legislativeRequirementsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          friableClearanceCertificateLimitationsTitle: "FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
          friableClearanceCertificateLimitationsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          inspectionDetailsTitle: "INSPECTION DETAILS",
          inspectionDetailsContent: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. {APPENDIX_REFERENCES}",
          
          inspectionExclusionsTitle: "INSPECTION EXCLUSIONS",
          inspectionExclusionsContent: "[DYNAMIC_CONTENT_NOT_LOADED]",
          
          clearanceCertificationTitle: "CLEARANCE CERTIFICATION",
          clearanceCertificationContent: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\n{AIR_MONITORING_RESULTS}\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
          
          signOffContent: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
          
          footerText: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}"
        }
      });
      
      await friableTemplate.save();
      console.log('Friable template created successfully');
    } else {
      console.log('Friable template already exists');
    }

    console.log('Template creation completed');
    process.exit(0);
  } catch (error) {
    console.error('Error creating templates:', error);
    process.exit(1);
  }
}

createDefaultTemplates(); 