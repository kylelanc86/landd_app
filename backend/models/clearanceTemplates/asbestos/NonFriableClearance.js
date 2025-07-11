const mongoose = require("mongoose");
const nonFriableClearanceDefaultContent = require("./defaultContent/NonFriableContent");

const nonFriableClearanceSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      default: "asbestosClearanceNonFriable",
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
        default: nonFriableClearanceDefaultContent.frontCoverTitle,
      },
      frontCoverSubtitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.frontCoverSubtitle,
      },
      
      // Version Control Page Content
      versionControlTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.versionControlTitle,
      },
      preparedForLabel: {
        type: String,
        default: nonFriableClearanceDefaultContent.preparedForLabel,
      },
      preparedByLabel: {
        type: String,
        default: nonFriableClearanceDefaultContent.preparedByLabel,
      },
      documentDetailsLabel: {
        type: String,
        default: nonFriableClearanceDefaultContent.documentDetailsLabel,
      },
      revisionHistoryLabel: {
        type: String,
        default: nonFriableClearanceDefaultContent.revisionHistoryLabel,
      },
      
      // Inspection Details Content
      inspectionDetailsTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.inspectionDetailsTitle,
      },
      inspectionDetailsContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.inspectionDetailsContent,
      },
      
      // Inspection Exclusions Content
      inspectionExclusionsTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.inspectionExclusionsTitle,
      },
      inspectionExclusionsContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.inspectionExclusionsContent,
      },
      
      // Clearance Certification Content
      clearanceCertificationTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.clearanceCertificationTitle,
      },
      clearanceCertificationContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.clearanceCertificationContent,
      },
      
      // Sign-off Content
      signOffContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.signOffContent,
      },
      
      // Signature Content
      signaturePlaceholder: {
        type: String,
        default: nonFriableClearanceDefaultContent.signaturePlaceholder,
      },
      
      // Background Information Content
      backgroundInformationTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.backgroundInformationTitle,
      },
      backgroundInformationContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.backgroundInformationContent,
      },
      
      // Legislative Requirements Content
      legislativeRequirementsTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.legislativeRequirementsTitle,
      },
      legislativeRequirementsContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.legislativeRequirementsContent,
      },
      
      // Non-Friable Clearance Certificate Limitations Content
      nonFriableClearanceCertificateLimitationsTitle: {
        type: String,
        default: nonFriableClearanceDefaultContent.nonFriableClearanceCertificateLimitationsTitle,
      },
      nonFriableClearanceCertificateLimitationsContent: {
        type: String,
        default: nonFriableClearanceDefaultContent.nonFriableClearanceCertificateLimitationsContent,
      },
      
      // Footer Content
      footerText: {
        type: String,
        default: nonFriableClearanceDefaultContent.footerText,
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

module.exports = mongoose.model("NonFriableClearance", nonFriableClearanceSchema); 