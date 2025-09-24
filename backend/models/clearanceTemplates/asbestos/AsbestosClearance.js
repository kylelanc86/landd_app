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
    inspectionTime: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["in progress", "complete", "Site Work Complete", "closed"],
      default: "in progress",
    },
    clearanceType: {
      type: String,
      enum: ["Non-friable", "Friable", "Mixed", "Complex"],
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
    airMonitoring: {
      type: Boolean,
      default: false,
    },
    airMonitoringReport: {
      type: String, // Will store the file path or base64 data
    },
    sitePlan: {
      type: Boolean,
      default: false,
    },
    sitePlanFile: {
      type: String, // Will store the file path or base64 data
    },
    jobSpecificExclusions: {
      type: String, // Job-specific exclusions text
    },
    notes: {
      type: String,
    },
    // Array of clearance items embedded directly in the clearance job
    items: [{
      locationDescription: {
        type: String,
        required: true,
      },
      levelFloor: {
        type: String,
        required: false,
      },
      roomArea: {
        type: String,
        required: true,
      },
      materialDescription: {
        type: String,
        required: true,
      },
      asbestosType: {
        type: String,
        enum: ["non-friable", "friable"],
        required: true,
      },
      photograph: {
        type: String, // Base64 image data
      },
      notes: {
        type: String,
      },
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
    revisionReasons: [{
      revisionNumber: {
        type: Number,
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      revisedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      revisedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
asbestosClearanceSchema.index({ projectId: 1, status: 1 });
asbestosClearanceSchema.index({ clearanceDate: 1 });

module.exports = mongoose.model("AsbestosClearance", asbestosClearanceSchema); 