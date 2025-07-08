const mongoose = require("mongoose");

const asbestosRemovalJobSchema = new mongoose.Schema(
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
    asbestosRemovalist: {
      type: String,
      required: true,
      enum: [
        "AGH",
        "Aztech Services",
        "Capstone",
        "Crown Asbestos Removals",
        "Empire Contracting",
        "Glade Group",
        "IAR",
        "Jesco",
        "Ozbestos",
        "Spec Services",
      ],
    },
    airMonitoring: {
      type: Boolean,
      default: false,
    },
    clearance: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["in_progress", "completed", "cancelled"],
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

// Index for better query performance
asbestosRemovalJobSchema.index({ projectId: 1, status: 1 });
asbestosRemovalJobSchema.index({ createdBy: 1 });
asbestosRemovalJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AsbestosRemovalJob", asbestosRemovalJobSchema); 