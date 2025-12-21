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
        "Filter Holder",
        "Fume Hood",
        "Furnace",
        "Graticule",
        "HSE Test Slide",
        "Micrometer",
        "Phase Contrast Microscope",
        "Pneumatic tester",
        "Polarised Light Microscope",
        "RI Liquids",
        "Site flowmeter",
        "Stereomicroscope"
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
    calibrationFrequency: {
      type: Number,
      required: false,
      min: 1,
      max: 60, // Assuming max 60 months (5 years)
    },
    // Note: Calibration data (lastCalibration, calibrationDue, flowrateCalibrations) 
    // is now fetched dynamically from calibration records, not stored in Equipment model
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Equipment", equipmentSchema); 