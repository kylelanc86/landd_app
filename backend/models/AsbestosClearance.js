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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to count clearance report items
asbestosClearanceSchema.virtual('items', {
  ref: 'AsbestosClearanceReport',
  localField: '_id',
  foreignField: 'clearanceId',
  count: true
});

// Index for better query performance
asbestosClearanceSchema.index({ projectId: 1, status: 1 });
asbestosClearanceSchema.index({ clearanceDate: 1 });

module.exports = mongoose.model("AsbestosClearance", asbestosClearanceSchema); 