const mongoose = require("mongoose");

const reportTemplateSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      enum: [
        "asbestosClearanceFriable",
        "asbestosClearanceNonFriable",
        "asbestosClearanceFriableNonFriableConditions",
        "asbestosClearanceVehicle",
        "leadAssessment",
        "asbestosAssessment",
      ],
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
        required: true,
      },
      subtitle: {
        type: String,
      },
    },
    // Unified sections that can handle all template types
    standardSections: {
      // Common sections for all templates
      backgroundInformationTitle: String,
      backgroundInformationContent: String,
      legislativeRequirementsTitle: String,
      legislativeRequirementsContent: String,
      inspectionDetailsTitle: String,
      inspectionDetailsContent: String,
      inspectionExclusionsTitle: String,
      inspectionExclusionsContent: String,
      clearanceCertificationTitle: String,
      clearanceCertificationContent: String,
      signOffContent: String,
      signaturePlaceholder: String,
      
      // Template-specific sections
      // Asbestos Clearance specific
      friableClearanceCertificateLimitationsTitle: String,
      friableClearanceCertificateLimitationsContent: String,
      nonFriableClearanceCertificateLimitationsTitle: String,
      nonFriableClearanceCertificateLimitationsContent: String,
      friableNonFriableConditionsCertificateLimitationsTitle: String,
      friableNonFriableConditionsCertificateLimitationsContent: String,
      vehicleCertificateLimitationsTitle: String,
      vehicleCertificateLimitationsContent: String,
      
      // Asbestos Assessment specific
      introductionTitle: String,
      introductionContent: String,
      surveyFindingsTitle: String,
      surveyFindingsContent: String,
      surveyFindingsContentNoSamples: String,
      discussionTitle: String,
      discussionContent: String,
      riskAssessmentTitle: String,
      riskAssessmentContent: String,
      controlMeasuresTitle: String,
      controlMeasuresContent: String,
      remediationRequirementsTitle: String,
      remediationRequirementsContent: String,
      legislationTitle: String,
      legislationContent: String,
      assessmentLimitationsTitle: String,
      assessmentLimitationsContent: String,
      
      // Lead Assessment specific
      executiveSummaryTitle: String,
      executiveSummaryContent: String,
      siteDescriptionTitle: String,
      siteDescriptionContent: String,
      assessmentMethodologyTitle: String,
      assessmentMethodologyContent: String,
      samplingResultsTitle: String,
      samplingResultsContent: String,
      recommendationsTitle: String,
      recommendationsContent: String,
      conclusionTitle: String,
      conclusionContent: String,
      
      // Version control and front cover (for clearance templates)
      frontCoverTitle: String,
      frontCoverSubtitle: String,
      versionControlTitle: String,
      preparedForLabel: String,
      preparedByLabel: String,
      documentDetailsLabel: String,
      revisionHistoryLabel: String,
    },
    // Selected legislation items for the template
    selectedLegislation: [{
      _id: String,
      text: String,
      legislationTitle: String,
      jurisdiction: String
    }],
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

// Ensure one template per type
reportTemplateSchema.index({ templateType: 1 }, { unique: true });

// Index for better query performance
reportTemplateSchema.index({ templateType: 1, createdAt: -1 });

module.exports = mongoose.model("ReportTemplate", reportTemplateSchema);
