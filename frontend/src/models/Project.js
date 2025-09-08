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
    categories: [{
      type: String,
      enum: [
        "Asbestos Management Plan",
        "Air Monitoring and Clearance",
        "Asbestos Materials Assessment",
        "Asbestos & Lead Paint Assessment",
        "Clearance Certificate",
        "Client Supplied - Bulk ID",
        "Client Supplied - Soil/dust (AS4964)",
        "Client Supplied - WA Guidelines",
        "Client Supplied - Fibre Count",
        "Hazardous Materials Management Plan",
        "Intrusive Asbestos Assessment",
        "Intrusive Hazardous Materials Assessment",
        "Lead Dust Assessment",
        "Lead Paint Assessment",
        "Lead Paint/Dust Assessment",
        "Mould/Moisture Assessment",
        "Mould/Moisture Validation",
        "Residential Asbestos Assessment",
        "Silica Air Monitoring",
        "Other"
      ]
    }],
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
    projectContact: {
      name: {
        type: String,
        required: false,
        trim: true
      },
      number: {
        type: String,
        required: false,
        trim: true
      },
      email: {
        type: String,
        required: false,
        trim: true,
        lowercase: true
      }
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