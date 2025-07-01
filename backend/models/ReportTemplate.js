const mongoose = require("mongoose");

const reportTemplateSchema = new mongoose.Schema(
  {
    templateType: {
      type: String,
      required: true,
      enum: ["asbestosClearance", "leadAssessment", "mouldAssessment"],
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
      introduction: {
        type: String,
        required: true,
      },
      methodology: {
        type: String,
        required: true,
      },
      conclusion: {
        type: String,
        required: true,
      },
      disclaimer: {
        type: String,
        required: true,
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