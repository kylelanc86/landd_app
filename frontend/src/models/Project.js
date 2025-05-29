const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    projectID: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    department: {
      type: String,
      required: true,
      enum: ["Asbestos & HAZMAT", "Occupational Hygiene", "Client Supplied"],
    },
    category: {
      type: String,
      required: false,
      enum: [
        "Asbestos Materials Assessment",
        "Asbestos & Lead Paint Assessment",
        "Lead Paint/Dust Assessment",
        "Air Monitoring and Clearance",
        "Clearance Certificate",
        "Commercial Asbestos Management Plan",
        "Hazardous Materials Management Plan",
        "Residential Asbestos Survey",
        "Silica Air Monitoring",
        "Mould/Moisture Assessment",
        "Other"
      ],
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Assigned",
        "In progress",
        "Samples submitted",
        "Lab Analysis Complete",
        "Report sent for review",
        "Ready for invoicing",
        "Invoice sent",
        "Job complete",
        "On hold",
        "Quote sent",
        "Cancelled",
      ],
    },
    address: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema); 