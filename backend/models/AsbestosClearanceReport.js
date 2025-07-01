const mongoose = require("mongoose");

const asbestosClearanceReportSchema = new mongoose.Schema(
  {
    clearanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AsbestosClearance",
      required: true,
    },
    locationDescription: {
      type: String,
      required: true,
    },
    materialDescription: {
      type: String,
      required: true,
    },
    asbestosType: {
      type: String,
      enum: ["friable", "non-friable"],
      required: true,
    },
    photograph: {
      type: String, // Base64 encoded image or file path
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// Index for better query performance
asbestosClearanceReportSchema.index({ clearanceId: 1 });
asbestosClearanceReportSchema.index({ createdAt: 1 });

module.exports = mongoose.model("AsbestosClearanceReport", asbestosClearanceReportSchema); 