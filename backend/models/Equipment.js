const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema(
  {
    equipmentReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    equipmentType: {
      type: String,
      required: true,
      enum: [
        "Acetone Vaporiser",
        "Air pump",
        "Bubble flowmeter",
        "Effective Filter Area",
        "Fume Hood",
        "Furnace",
        "Graticule",
        "HSE Test Slide",
        "Micrometer",
        "Microscope",
        "Pneumatic tester",
        "RI Liquids",
        "Site flowmeter"
      ],
    },
    section: {
      type: String,
      required: true,
      enum: ["Air Monitoring", "Fibre ID"],
    },
    brandModel: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "calibration due", "out-of-service"],
      default: "active",
    },
    lastCalibration: {
      type: Date,
      required: true,
    },
    calibrationDue: {
      type: Date,
      required: true,
    },
    calibrationFrequency: {
      type: Number,
      required: true,
      min: 1,
      max: 60, // Assuming max 60 months (5 years)
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Equipment", equipmentSchema); 