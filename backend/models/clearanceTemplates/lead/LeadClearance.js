const mongoose = require("mongoose");

const leadClearanceSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    leadRemovalJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadRemovalJob",
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
    leadAbatementContractor: {
      type: String,
      required: true,
    },
    leadMonitoring: {
      type: Boolean,
      default: false,
    },
    leadMonitoringReports: [
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
      type: String,
    },
    sitePlanSource: {
      type: String,
      enum: ["uploaded", "drawn"],
    },
    sitePlanLegend: [
      {
        color: { type: String },
        description: { type: String },
      },
    ],
    sitePlanLegendTitle: { type: String },
    sitePlanFigureTitle: { type: String },
    jobSpecificExclusions: { type: String },
    notes: { type: String },
    vehicleEquipmentDescription: { type: String, required: false },
    items: [
      {
        locationDescription: { type: String, required: true },
        levelFloor: { type: String, required: false },
        roomArea: { type: String, required: true },
        materialDescription: { type: String, required: true },
        photographs: [
          {
            data: { type: String, required: true },
            includeInReport: { type: Boolean, default: true },
            uploadedAt: { type: Date, default: Date.now },
            photoNumber: { type: Number },
            description: { type: String },
          },
        ],
        notes: { type: String },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revision: { type: Number, default: 0, min: 0 },
    revisionReasons: [
      {
        revisionNumber: { type: Number, required: true },
        reason: { type: String, required: true },
        revisedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        revisedAt: { type: Date, default: Date.now },
      },
    ],
    reportApprovedBy: { type: String, required: false },
    reportIssueDate: { type: Date, required: false },
    authorisationRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    authorisationRequestedByEmail: { type: String, required: false },
    reportViewedAt: { type: Date, required: false },
    sequenceNumber: { type: Number, required: false, min: 1, max: 5 },
    legislation: [
      {
        _id: String,
        text: String,
        legislationTitle: String,
        jurisdiction: String,
      },
    ],
  },
  {
    timestamps: true,
    collection: "lead_clearances",
  }
);

leadClearanceSchema.index({ projectId: 1, status: 1 });
leadClearanceSchema.index({ clearanceDate: 1 });
leadClearanceSchema.index({ leadRemovalJobId: 1 });
leadClearanceSchema.index({ projectId: 1, clearanceType: 1, clearanceDate: 1 });

module.exports = mongoose.model("LeadClearance", leadClearanceSchema);
