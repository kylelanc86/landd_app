const mongoose = require("mongoose");

const timesheetSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: function() {
        return !this.isAdminWork && !this.isBreak;
      },
    },
    description: {
      type: String,
      required: false,
    },
    isAdminWork: {
      type: Boolean,
      default: false,
    },
    isBreak: {
      type: Boolean,
      default: false,
    },
    projectInputType: {
      type: String,
      enum: ["site_work", "reporting", "project_admin", null],
      required: function() {
        return !this.isAdminWork && !this.isBreak;
      },
    },
    status: {
      type: String,
      enum: ["incomplete", "finalised", "absent"],
      default: "incomplete"
    },
    finalisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    finalisedAt: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Add index for efficient querying
timesheetSchema.index({ userId: 1, date: 1 });

// Update the updatedAt timestamp before saving
timesheetSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

const Timesheet = mongoose.model("Timesheet", timesheetSchema);

module.exports = Timesheet; 