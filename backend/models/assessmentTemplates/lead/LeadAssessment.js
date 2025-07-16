const mongoose = require("mongoose");
const leadAssessmentDefaultContent = require("./defaultContent/LeadAssessmentContent");

const leadAssessmentSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      default: "leadAssessment",
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
        default: "LEAD ASSESSMENT REPORT",
        required: true,
      },
      subtitle: {
        type: String,
        default: "Lead Hazard Assessment",
      },
    },
    // Lead-specific sections that are different from asbestos clearance
    leadAssessmentSections: {
      // Executive Summary
      executiveSummaryTitle: {
        type: String,
        default: leadAssessmentDefaultContent.executiveSummaryTitle,
      },
      executiveSummaryContent: {
        type: String,
        default: leadAssessmentDefaultContent.executiveSummaryContent,
      },
      
      // Site Description
      siteDescriptionTitle: {
        type: String,
        default: leadAssessmentDefaultContent.siteDescriptionTitle,
      },
      siteDescriptionContent: {
        type: String,
        default: leadAssessmentDefaultContent.siteDescriptionContent,
      },
      
      // Assessment Methodology
      assessmentMethodologyTitle: {
        type: String,
        default: leadAssessmentDefaultContent.assessmentMethodologyTitle,
      },
      assessmentMethodologyContent: {
        type: String,
        default: leadAssessmentDefaultContent.assessmentMethodologyContent,
      },
      
      // Sampling Results
      samplingResultsTitle: {
        type: String,
        default: leadAssessmentDefaultContent.samplingResultsTitle,
      },
      samplingResultsContent: {
        type: String,
        default: leadAssessmentDefaultContent.samplingResultsContent,
      },
      
      // Risk Assessment
      riskAssessmentTitle: {
        type: String,
        default: leadAssessmentDefaultContent.riskAssessmentTitle,
      },
      riskAssessmentContent: {
        type: String,
        default: leadAssessmentDefaultContent.riskAssessmentContent,
      },
      
      // Recommendations
      recommendationsTitle: {
        type: String,
        default: leadAssessmentDefaultContent.recommendationsTitle,
      },
      recommendationsContent: {
        type: String,
        default: leadAssessmentDefaultContent.recommendationsContent,
      },
      
      // Conclusion
      conclusionTitle: {
        type: String,
        default: leadAssessmentDefaultContent.conclusionTitle,
      },
      conclusionContent: {
        type: String,
        default: leadAssessmentDefaultContent.conclusionContent,
      },
      
      // Footer
      footerText: {
        type: String,
        default: leadAssessmentDefaultContent.footerText,
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

module.exports = mongoose.model("LeadAssessment", leadAssessmentSchema); 