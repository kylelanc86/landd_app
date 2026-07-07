const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    data: { type: String, required: true },
  },
  { _id: true }
);

const EQUIPMENT_TYPE = 'Micrometer';

const micrometerCalibrationSchema = new mongoose.Schema(
  {
    calibrationId: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
    },
    micrometerReference: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    calibrationCompany: {
      type: String,
      required: true,
      trim: true,
    },
    uncertaintyOfMeasurement: {
      type: Number,
      required: true,
    },
    certificates: {
      type: [certificateSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    nextCalibration: {
      type: Date,
      required: false,
    },
    calibratedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

const {
  calculateEquipmentNextCalibration,
} = require('../utils/calculateEquipmentNextCalibration');

micrometerCalibrationSchema.pre('save', async function (next) {
  if (this.date) {
    try {
      this.nextCalibration = await calculateEquipmentNextCalibration(
        this.date,
        EQUIPMENT_TYPE
      );
    } catch (error) {
      const nextDue = new Date(this.date);
      nextDue.setMonth(nextDue.getMonth() + 12);
      this.nextCalibration = nextDue;
    }
  }
  next();
});

micrometerCalibrationSchema.index({ calibrationId: 1 });
micrometerCalibrationSchema.index({ micrometerReference: 1 });
micrometerCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model(
  'MicrometerCalibration',
  micrometerCalibrationSchema
);
