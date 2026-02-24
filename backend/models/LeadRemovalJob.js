const mongoose = require("mongoose");

const leadRemovalJobSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    projectName: {
      type: String,
      required: true,
    },
    client: {
      type: String,
      required: true,
    },
    leadAbatementContractor: {
      type: String,
      required: true,
    },
    jurisdiction: {
      type: String,
      enum: ["ACT", "NSW"],
      default: "ACT",
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "cancelled", "archived"],
      default: "in_progress",
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

leadRemovalJobSchema.index({ projectId: 1, status: 1 });
leadRemovalJobSchema.index({ createdBy: 1 });

module.exports = mongoose.model("LeadRemovalJob", leadRemovalJobSchema);
