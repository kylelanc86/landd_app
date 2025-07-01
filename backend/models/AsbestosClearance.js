const mongoose = require("mongoose");

const asbestosClearanceSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    clearanceDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["in progress", "complete"],
      default: "in progress",
    },
    clearanceType: {
      type: String,
      enum: ["Non-friable", "Friable"],
      required: true,
    },
    LAA: {
      type: String,
      required: true,
    },
    asbestosRemovalist: {
      type: String,
      required: true,
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
asbestosClearanceSchema.index({ projectId: 1, status: 1 });
asbestosClearanceSchema.index({ clearanceDate: 1 });

module.exports = mongoose.model("AsbestosClearance", asbestosClearanceSchema); 