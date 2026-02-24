const mongoose = require("mongoose");

/**
 * Lead-specific clearance schema.
 * Differs from AsbestosClearance: uses leadRemovalJobId, leadAbatementContractor,
 * leadMonitoring/leadMonitoringReports, and lead-specific clearance types.
 * Items do not have asbestosType (friable/non-friable).
 */
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
    secondaryHeader: {
      type: String,
      required: false,
    },
    consultant: {
      type: String,
      required: true,
    },
    leadAbatementContractor: {
      type: String,
      required: true,
    },
    /** ACT or NSW - used to filter {LEGISLATION} in report template */
    jurisdiction: {
      type: String,
      enum: ["ACT", "NSW"],
      required: false,
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
    /** Description of works (free text, optional) */
    descriptionOfWorks: { type: String, required: false },
    vehicleEquipmentDescription: { type: String, required: false },
    /** Used for PDF generation when clearance requires custom content */
    useComplexTemplate: {
      type: Boolean,
      default: false,
    },
    /** Pre-works and validation samples from Clearance Sampling page (persisted for use on Items page) */
    sampling: {
      preWorksSamples: [{ type: mongoose.Schema.Types.Mixed }],
      validationSamples: [{ type: mongoose.Schema.Types.Mixed }],
    },
    /** Embedded lead clearance items - no asbestosType (friable/non-friable) */
    items: [
      {
        locationDescription: { type: String, required: true },
        levelFloor: { type: String, required: false },
        roomArea: { type: String, required: true },
        worksCompleted: { type: String, required: true },
        /** One of: 'Visual inspection' | 'Visual inspection and validation sampling' */
        leadValidationType: { type: String, required: false },
        /** Sample refs (e.g. LD-1) linking to Lead Clearance Sampling */
        samples: [{ type: String }],
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
leadClearanceSchema.index({ projectId: 1, clearanceDate: 1 });

module.exports = mongoose.model("LeadClearance", leadClearanceSchema);
