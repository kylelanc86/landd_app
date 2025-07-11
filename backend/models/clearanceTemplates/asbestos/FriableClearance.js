const mongoose = require("mongoose");
const friableClearanceDefaultContent = require("./defaultContent/FriableContent");

const friableClearanceSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      default: "asbestosClearanceFriable",
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
        default: friableClearanceDefaultContent.frontCoverTitle,
      },
      frontCoverSubtitle: {
        type: String,
        default: friableClearanceDefaultContent.frontCoverSubtitle,
      },
      
      // Version Control Page Content
      versionControlTitle: {
        type: String,
        default: friableClearanceDefaultContent.versionControlTitle,
      },
      preparedForLabel: {
        type: String,
        default: friableClearanceDefaultContent.preparedForLabel,
      },
      preparedByLabel: {
        type: String,
        default: friableClearanceDefaultContent.preparedByLabel,
      },
      documentDetailsLabel: {
        type: String,
        default: friableClearanceDefaultContent.documentDetailsLabel,
      },
      revisionHistoryLabel: {
        type: String,
        default: friableClearanceDefaultContent.revisionHistoryLabel,
      },
      
      // Inspection Details Content
      inspectionDetailsTitle: {
        type: String,
        default: friableClearanceDefaultContent.inspectionDetailsTitle,
      },
      inspectionDetailsContent: {
        type: String,
        default: friableClearanceDefaultContent.inspectionDetailsContent,
      },
      
      // Inspection Exclusions Content
      inspectionExclusionsTitle: {
        type: String,
        default: friableClearanceDefaultContent.inspectionExclusionsTitle,
      },
      inspectionExclusionsContent: {
        type: String,
        default: friableClearanceDefaultContent.inspectionExclusionsContent,
      },
      
      // Clearance Certification Content
      clearanceCertificationTitle: {
        type: String,
        default: friableClearanceDefaultContent.clearanceCertificationTitle,
      },
      clearanceCertificationContent: {
        type: String,
        default: friableClearanceDefaultContent.clearanceCertificationContent,
      },
      
      // Sign-off Content
      signOffContent: {
        type: String,
        default: friableClearanceDefaultContent.signOffContent,
      },
      
      // Signature Content
      signaturePlaceholder: {
        type: String,
        default: friableClearanceDefaultContent.signaturePlaceholder,
      },
      
      // Background Information Content
      backgroundInformationTitle: {
        type: String,
        default: friableClearanceDefaultContent.backgroundInformationTitle,
      },
      backgroundInformationContent: {
        type: String,
        default: friableClearanceDefaultContent.backgroundInformationContent,
      },
      
      // Legislative Requirements Content
      legislativeRequirementsTitle: {
        type: String,
        default: friableClearanceDefaultContent.legislativeRequirementsTitle,
      },
      legislativeRequirementsContent: {
        type: String,
        default: friableClearanceDefaultContent.legislativeRequirementsContent,
      },
      
      // Friable Clearance Certificate Limitations Content
      friableClearanceCertificateLimitationsTitle: {
        type: String,
        default: friableClearanceDefaultContent.friableClearanceCertificateLimitationsTitle,
      },
      friableClearanceCertificateLimitationsContent: {
        type: String,
        default: friableClearanceDefaultContent.friableClearanceCertificateLimitationsContent,
      },
      
      // Footer Content
      footerText: {
        type: String,
        default: friableClearanceDefaultContent.footerText,
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

module.exports = mongoose.model("FriableClearance", friableClearanceSchema); 