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

const sieveCalibrationSchema = new mongoose.Schema(
  {
    calibrationId: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
    },
    sieveReference: {
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
    certificates: {
      type: [certificateSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
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

sieveCalibrationSchema.index({ calibrationId: 1 });
sieveCalibrationSchema.index({ sieveReference: 1 });
sieveCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model('SieveCalibration', sieveCalibrationSchema);
