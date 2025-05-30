const mongoose = require("mongoose");

const timesheetStatusSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ["incomplete", "finalised", "absent"],
      default: "incomplete"
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    }
  },
  { timestamps: true }
);

// Add compound index for efficient querying
timesheetStatusSchema.index({ userId: 1, date: 1 }, { unique: true });

const TimesheetStatus = mongoose.model("TimesheetStatus", timesheetStatusSchema);

module.exports = TimesheetStatus; 