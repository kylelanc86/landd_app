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
      enum: ["pending", "in_progress", "completed", "failed"],
      default: "pending",
    },
    LAA: {
      type: String,
      required: true,
    },
    areas: [{
      type: String,
    }],
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