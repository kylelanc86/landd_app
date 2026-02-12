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
    },
    airMonitoring: {
      type: Boolean,
      default: false,
    },
    clearance: {
      type: Boolean,
      default: false,
    },
    jobType: {
      type: String,
      enum: [
        "none",
        "air_monitoring",
        "clearance",
        "air_monitoring_and_clearance",
      ],
      default: "none",
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

const deriveJobType = (airMonitoring = false, clearance = false) => {
  if (airMonitoring && clearance) {
    return "air_monitoring_and_clearance";
  }
  if (airMonitoring) {
    return "air_monitoring";
  }
  if (clearance) {
    return "clearance";
  }
  return "none";
};

asbestosRemovalJobSchema.pre("save", function (next) {
  if (
    this.isModified("airMonitoring") ||
    this.isModified("clearance") ||
    this.isNew ||
    !this.jobType
  ) {
    this.jobType = deriveJobType(this.airMonitoring, this.clearance);
  }
  next();
});

// Index for better query performance
asbestosRemovalJobSchema.index({ projectId: 1, status: 1 });
asbestosRemovalJobSchema.index({ createdBy: 1 });

module.exports = mongoose.model("AsbestosRemovalJob", asbestosRemovalJobSchema);
module.exports.deriveJobType = deriveJobType;