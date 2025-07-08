const mongoose = require("mongoose");

const reportTemplateSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      required: true,
      enum: [
        "asbestosClearanceNonFriable", 
        "asbestosClearanceFriable", 
        "asbestosAssessment", 
        "leadAssessment", 
        "mouldAssessment",
        "airMonitoringReport",
        "fibreIdentificationReport",
        "inspectionReport",
        "complianceReport",
        "riskAssessmentReport",
        "managementPlanReport"
      ],
      unique: true,
    },
    companyDetails: {
      name: {
        type: String,
        default: "Lancaster & Dickenson Consulting Pty Ltd",
      },
      address: {
        type: String,
        default: "4/6 Dacre Street, Mitchell ACT 2911",
      },
      email: {
        type: String,
        default: "enquiries@landd.com.au",
      },
      phone: {
        type: String,
        default: "(02) 6241 2779",
      },
      website: {
        type: String,
        default: "www.landd.com.au",
      },
      abn: {
        type: String,
        default: "74 169 785 915",
      },
    },
    reportHeaders: {
      title: {
        type: String,
        required: true,
      },
      subtitle: {
        type: String,
        default: "",
      },
    },
    standardSections: {
      // Front Cover Content
      frontCoverTitle: {
        type: String,
        default: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
      },
      frontCoverSubtitle: {
        type: String,
        default: "Clearance Inspection Report",
      },
      
      // Version Control Page Content
      versionControlTitle: {
        type: String,
        default: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
      },
      preparedForLabel: {
        type: String,
        default: "PREPARED FOR:",
      },
      preparedByLabel: {
        type: String,
        default: "PREPARED BY:",
      },
      documentDetailsLabel: {
        type: String,
        default: "DOCUMENT DETAILS",
      },
      revisionHistoryLabel: {
        type: String,
        default: "REVISION HISTORY",
      },
      
      // Inspection Details Content
      inspectionDetailsTitle: {
        type: String,
        default: "INSPECTION DETAILS",
      },
      inspectionDetailsContent: {
        type: String,
        default: "Following discussions with {CLIENT_NAME}, Lancaster and Dickenson Consulting (L & D) were contracted to undertake a visual clearance inspection following the removal of {ASBESTOS_TYPE} asbestos from {SITE_NAME} (herein referred to as 'the Site').\n\nAsbestos removal works were undertaken by {ASBESTOS_REMOVALIST}. {LAA_NAME} (ACT Licensed Asbestos Assessor - {LAA_LICENSE}) from L&D visited the Site at {INSPECTION_TIME} on {INSPECTION_DATE}.\n\nTable 1 below outlines the ACM that formed part of the inspection. Photographs of the Asbestos Removal Area and a Site Plan are presented in Appendix A and Appendix B respectively.",
      },
      
      // Inspection Exclusions Content
      inspectionExclusionsTitle: {
        type: String,
        default: "INSPECTION EXCLUSIONS",
      },
      inspectionExclusionsContent: {
        type: String,
        default: "This clearance certificate is specific to the scope of removal works detailed above. ACM may be present beyond the inspected area. Asbestos fibre cement packers remain under the windowsill. The packers were sprayed with black spray. The packers should be removed prior to commencing works that may disturb or damage the material.",
      },
      
      // Clearance Certification Content
      clearanceCertificationTitle: {
        type: String,
        default: "CLEARANCE CERTIFICATION",
      },
      clearanceCertificationContent: {
        type: String,
        default: "An inspection of the asbestos removal area and the surrounding areas (including access and egress pathways) was undertaken on {INSPECTION_DATE}. The LAA found no visible asbestos residue from asbestos removal work in the asbestos removal area, or in the vicinity of the area, where the asbestos removal works were carried out.\n\nThe LAA considers that the asbestos removal area does not pose a risk to health and safety from exposure to asbestos and may be re-occupied.",
      },
      
      // Sign-off Content
      signOffContent: {
        type: String,
        default: "Please do not hesitate to contact the undersigned should you have any queries regarding this report.\n\nFor and on behalf of Lancaster and Dickenson Consulting.\n\n{LAA_NAME}\nLicensed Asbestos Assessor - {LAA_LICENSE}",
      },
      
      // Signature Content
      signaturePlaceholder: {
        type: String,
        default: "{SIGNATURE_IMAGE}",
      },
      
      // Background Information Content
      backgroundInformationTitle: {
        type: String,
        default: "BACKGROUND INFORMATION REGARDING NON-FRIABLE CLEARANCE INSPECTIONS",
      },
      backgroundInformationContent: {
        type: String,
        default: "Following completion of non-friable asbestos removal works undertaken by a suitably licenced Asbestos Removal Contractor, a clearance inspection must be completed by an independent LAA / a competent person. The clearance inspection includes an assessment of the following:\n\n• Visual inspection of the work area for asbestos dust or debris\n• Visual inspection of the adjacent area including the access and egress pathways for visible asbestos dust and debris\n\nIt is required that a Non-Friable Clearance Certificate be issued on completion of a successful inspection. The issuer needs to ensure:\n\n• This certificate should be issued prior to the area being re-occupied. This chain of events should occur regardless of whether the site is a commercial or residential property.\n• The asbestos removal area and areas immediately surrounding it are visibly clean from asbestos contamination\n• The removal area does not pose a risk to health safety and safety from exposure to asbestos",
      },
      
      // Legislative Requirements Content
      legislativeRequirementsTitle: {
        type: String,
        default: "LEGISLATIVE REQUIREMENTS",
      },
      legislativeRequirementsContent: {
        type: String,
        default: "Non-Friable Clearance Certificates should be written in general accordance with and with reference to:\n\n• ACT Work Health and Safety (WHS) Act 2011\n• ACT Work Health and Safety Regulation 2011\n• ACT Work Health and Safety (How to Safely Remove Asbestos Code of Practice) 2022",
      },
      
      // Limitations Content
      nonFriableClearanceCertificateLimitationsTitle: {
        type: String,
        default: "NON-FRIABLE CLEARANCE CERTIFICATE LIMITATIONS",
      },
      nonFriableClearanceCertificateLimitationsContent: {
        type: String,
        default: "The visual clearance inspection was only carried out in the locations outlined within this document. L&D did not inspect any areas of the property that fall outside of the locations listed in this certificate and therefore make no comment regarding the presence or condition of other ACM that may or may not be present. When undertaking the inspection, the LAA tries to inspect as much of the asbestos removal area as possible. However, no inspection is absolute. Should suspect ACM be identified following the inspection, works should cease until an assessment of the materials is completed.",
      },
      
      // Footer Content
      footerText: {
        type: String,
        default: "{REPORT_TYPE} Clearance Certificate: {SITE_NAME}",
      },
      
      // Legacy fields for other report types
      introduction: {
        type: String,
        default: "This report presents the results of the asbestos removal clearance inspection conducted in accordance with the requirements of the Work Health and Safety Act 2011 and associated regulations.",
      },
      methodology: {
        type: String,
        default: "The clearance inspection was conducted using visual inspection techniques and air monitoring as required by the relevant legislation and industry standards.",
      },
      conclusion: {
        type: String,
        default: "Based on the inspection results, the area has been cleared for re-occupation following the asbestos removal works.",
      },
      disclaimer: {
        type: String,
        default: "This report is prepared for the specific purpose stated and should not be used for any other purpose without the written consent of Lancaster & Dickenson Consulting Pty Ltd.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
reportTemplateSchema.index({ templateType: 1 });

module.exports = mongoose.model("ReportTemplate", reportTemplateSchema); 