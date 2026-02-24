const mongoose = require("mongoose");

/**
 * Lead-specific clearance items schema.
 * Differs from AsbestosClearanceItems: no asbestosType (friable/non-friable)
 * since lead clearances use different classification.
 */
const leadClearanceItemsSchema = new mongoose.Schema(
  {
    clearanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LeadClearance",
      required: true,
    },
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
    worksCompleted: {
      type: String,
      required: true,
    },
    /** One of: 'Visual inspection' | 'Visual inspection and validation sampling' */
    leadValidationType: { type: String, required: false },
    /** Sample refs (e.g. LD-1) linking to Lead Clearance Sampling */
    samples: [{ type: String }],
    /** Lead items do not have asbestosType - lead uses different classifications */
    photographs: [
      {
        data: {
          type: String,
          required: true,
        },
        includeInReport: {
          type: Boolean,
          default: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
        photoNumber: { type: Number },
        description: { type: String },
      },
    ],
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
    collection: "lead_clearance_items",
  }
);

leadClearanceItemsSchema.index({ clearanceId: 1 });
leadClearanceItemsSchema.index({ createdAt: 1 });

module.exports = mongoose.model("LeadClearanceItems", leadClearanceItemsSchema);
