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

const primaryFlowmeterCalibrationSchema = new mongoose.Schema(
  {
    calibrationId: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
    },
    flowmeterReference: {
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
  calculatePrimaryFlowmeterNextCalibration,
} = require('../utils/calculatePrimaryFlowmeterNextCalibration');

primaryFlowmeterCalibrationSchema.pre('save', async function (next) {
  if (this.date) {
    try {
      this.nextCalibration = await calculatePrimaryFlowmeterNextCalibration(
        this.date
      );
    } catch (error) {
      const nextDue = new Date(this.date);
      nextDue.setFullYear(nextDue.getFullYear() + 5);
      this.nextCalibration = nextDue;
    }
  }

  next();
});

primaryFlowmeterCalibrationSchema.index({ calibrationId: 1 });
primaryFlowmeterCalibrationSchema.index({ flowmeterReference: 1 });
primaryFlowmeterCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model(
  'PrimaryFlowmeterCalibration',
  primaryFlowmeterCalibrationSchema
);
