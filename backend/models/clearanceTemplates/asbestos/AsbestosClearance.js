const mongoose = require("mongoose");

const asbestosClearanceSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    asbestosRemovalJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AsbestosRemovalJob",
      required: false,
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
      enum: ["Non-friable", "Friable", "Friable (Non-Friable Conditions)", "Vehicle/Equipment"],
      required: true,
    },
    jurisdiction: {
      type: String,
      enum: ["ACT", "NSW"],
      required: true,
    },
    secondaryHeader: {
      type: String,
      required: false,
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
      type: String, // Legacy: single report base64 (use airMonitoringReports for multiple)
    },
    airMonitoringReports: [
      {
        reportData: { type: String },
        shiftDate: { type: Date },
        shiftId: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
      },
    ],
    sitePlan: {
      type: Boolean,
      default: false,
    },
    sitePlanFile: {
      type: String, // Will store the file path or base64 data
    },
    sitePlanSource: {
      type: String,
      enum: ["uploaded", "drawn"],
    },
    sitePlanLegend: [
      {
        color: {
          type: String,
        },
        description: {
          type: String,
        },
      },
    ],
    sitePlanLegendTitle: {
      type: String,
    },
    sitePlanFigureTitle: {
      type: String,
    },
    jobSpecificExclusions: {
      type: String, // Job-specific exclusions text
    },
    notes: {
      type: String,
    },
    vehicleEquipmentDescription: {
      type: String,
      required: false,
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
      photographs: [{
        data: {
          type: String, // Base64 image data
          required: true,
        },
        includeInReport: {
          type: Boolean,
          default: true, // By default, include photos in report
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        photoNumber: {
          type: Number,
          required: false,
        },
        description: {
          type: String,
          required: false,
        },
        arrow: {
          x: { type: Number, required: false },
          y: { type: Number, required: false },
          rotation: { type: Number, default: 0 },
          color: { type: String, required: false },
        },
        arrows: [{
          x: { type: Number, required: true },
          y: { type: Number, required: true },
          rotation: { type: Number, default: -45 },
          color: { type: String, default: "#f44336" },
        }],
      }],
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
    reportApprovedBy: {
      type: String,
      required: false,
    },
    reportIssueDate: {
      type: Date,
      required: false,
    },
    authorisationRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    authorisationRequestedByEmail: {
      type: String,
      required: false,
    },
    reportViewedAt: {
      type: Date,
      required: false,
    },
    sequenceNumber: {
      type: Number,
      required: false,
      min: 1,
      max: 5,
    },
    // Legislation snapshot at job creation (state-specific, from report template); used for {LEGISLATION} in PDFs
    legislation: [{
      _id: String,
      text: String,
      legislationTitle: String,
      jurisdiction: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
asbestosClearanceSchema.index({ projectId: 1, status: 1 });
asbestosClearanceSchema.index({ clearanceDate: 1 });
asbestosClearanceSchema.index({ asbestosRemovalJobId: 1 });
asbestosClearanceSchema.index({ projectId: 1, clearanceType: 1, clearanceDate: 1 });

module.exports = mongoose.model("AsbestosClearance", asbestosClearanceSchema); 