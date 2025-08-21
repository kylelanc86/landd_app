const mongoose = require("mongoose");
const mixedClearanceDefaultContent = require("./defaultContent/MixedContent");

const mixedClearanceSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      default: "asbestosClearanceMixed",
      required: true,
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
        default: "ASBESTOS REMOVAL CLEARANCE CERTIFICATE",
        required: true,
      },
      subtitle: {
        type: String,
        default: "Clearance Inspection Report",
      },
    },
    standardSections: {
      // Front Cover Content
      frontCoverTitle: {
        type: String,
        default: mixedClearanceDefaultContent.frontCoverTitle,
      },
      frontCoverSubtitle: {
        type: String,
        default: mixedClearanceDefaultContent.frontCoverSubtitle,
      },
      
      // Version Control Page Content
      versionControlTitle: {
        type: String,
        default: mixedClearanceDefaultContent.versionControlTitle,
      },
      preparedForLabel: {
        type: String,
        default: mixedClearanceDefaultContent.preparedForLabel,
      },
      preparedByLabel: {
        type: String,
        default: mixedClearanceDefaultContent.preparedByLabel,
      },
      documentDetailsLabel: {
        type: String,
        default: mixedClearanceDefaultContent.documentDetailsLabel,
      },
      revisionHistoryLabel: {
        type: String,
        default: mixedClearanceDefaultContent.revisionHistoryLabel,
      },
      
      // Inspection Details Content
      inspectionDetailsTitle: {
        type: String,
        default: mixedClearanceDefaultContent.inspectionDetailsTitle,
      },
      inspectionDetailsContent: {
        type: String,
        default: mixedClearanceDefaultContent.inspectionDetailsContent,
      },
      
      // Inspection Exclusions Content
      inspectionExclusionsTitle: {
        type: String,
        default: mixedClearanceDefaultContent.inspectionExclusionsTitle,
      },
      inspectionExclusionsContent: {
        type: String,
        default: mixedClearanceDefaultContent.inspectionExclusionsContent,
      },
      
      // Clearance Certification Content
      clearanceCertificationTitle: {
        type: String,
        default: mixedClearanceDefaultContent.clearanceCertificationTitle,
      },
      clearanceCertificationContent: {
        type: String,
        default: mixedClearanceDefaultContent.clearanceCertificationContent,
      },
      
      // Sign-off Content
      signOffContent: {
        type: String,
        default: mixedClearanceDefaultContent.signOffContent,
      },
      
      // Signature Content
      signaturePlaceholder: {
        type: String,
        default: mixedClearanceDefaultContent.signaturePlaceholder,
      },
      
      // Background Information Content
      backgroundInformationTitle: {
        type: String,
        default: mixedClearanceDefaultContent.backgroundInformationTitle,
      },
      backgroundInformationContent: {
        type: String,
        default: mixedClearanceDefaultContent.backgroundInformationContent,
      },
      
      // Legislative Requirements Content
      legislativeRequirementsTitle: {
        type: String,
        default: mixedClearanceDefaultContent.legislativeRequirementsTitle,
      },
      legislativeRequirementsContent: {
        type: String,
        default: mixedClearanceDefaultContent.legislativeRequirementsContent,
      },
      
      // Mixed Clearance Certificate Limitations Content
      mixedClearanceCertificateLimitationsTitle: {
        type: String,
        default: mixedClearanceDefaultContent.mixedClearanceCertificateLimitationsTitle,
      },
      mixedClearanceCertificateLimitationsContent: {
        type: String,
        default: mixedClearanceDefaultContent.mixedClearanceCertificateLimitationsContent,
      },
      
      // Footer Content
      footerText: {
        type: String,
        default: mixedClearanceDefaultContent.footerText,
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

// Create a compound index on templateType to ensure uniqueness
mixedClearanceSchema.index({ templateType: 1 }, { unique: true });

const MixedClearance = mongoose.model("MixedClearance", mixedClearanceSchema);

module.exports = MixedClearance;
