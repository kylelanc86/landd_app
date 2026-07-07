const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    data: {
      type: String,
      required: true,
    },
  },
  { _id: true }
);

const pneumaticTesterCalibrationSchema = new mongoose.Schema(
  {
    calibrationId: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
    },
    pneumaticTesterReference: {
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
  {
    timestamps: true,
  }
);

const {
  calculatePneumaticTesterNextCalibration,
} = require('../utils/calculatePneumaticTesterNextCalibration');

pneumaticTesterCalibrationSchema.pre('save', async function (next) {
  if (this.date) {
    try {
      this.nextCalibration = await calculatePneumaticTesterNextCalibration(this.date);
    } catch (error) {
      const nextDue = new Date(this.date);
      nextDue.setMonth(nextDue.getMonth() + 12);
      this.nextCalibration = nextDue;
    }
  }

  next();
});

pneumaticTesterCalibrationSchema.index({ calibrationId: 1 });
pneumaticTesterCalibrationSchema.index({ pneumaticTesterReference: 1 });
pneumaticTesterCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model(
  'PneumaticTesterCalibration',
  pneumaticTesterCalibrationSchema
);
