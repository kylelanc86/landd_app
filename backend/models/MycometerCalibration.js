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

const MYCOMETER_EQUIPMENT_TYPES = [
  'Mycometer Analyser',
  'Mycometer Rotameter',
];

const mycometerCalibrationSchema = new mongoose.Schema(
  {
    calibrationId: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
    },
    mycometerReference: {
      type: String,
      required: true,
      trim: true,
    },
    equipmentType: {
      type: String,
      required: true,
      enum: MYCOMETER_EQUIPMENT_TYPES,
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

mycometerCalibrationSchema.pre('save', async function (next) {
  if (this.date && this.equipmentType) {
    try {
      this.nextCalibration = await calculateEquipmentNextCalibration(
        this.date,
        this.equipmentType
      );
    } catch (error) {
      const nextDue = new Date(this.date);
      nextDue.setMonth(nextDue.getMonth() + 12);
      this.nextCalibration = nextDue;
    }
  }
  next();
});

mycometerCalibrationSchema.index({ calibrationId: 1 });
mycometerCalibrationSchema.index({ mycometerReference: 1 });
mycometerCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model('MycometerCalibration', mycometerCalibrationSchema);
module.exports.MYCOMETER_EQUIPMENT_TYPES = MYCOMETER_EQUIPMENT_TYPES;
