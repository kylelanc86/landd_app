const mongoose = require('mongoose');

const efaCalibrationSchema = new mongoose.Schema({
  calibrationId: {
    type: String,
    required: false,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  filterHolderModel: {
    type: String,
    required: true,
    trim: true
  },
  filter1Diameter1: {
    type: Number,
    required: false,
    min: 0
  },
  filter1Diameter2: {
    type: Number,
    required: false,
    min: 0
  },
  filter2Diameter1: {
    type: Number,
    required: false,
    min: 0
  },
  filter2Diameter2: {
    type: Number,
    required: false,
    min: 0
  },
  filter3Diameter1: {
    type: Number,
    required: false,
    min: 0
  },
  filter3Diameter2: {
    type: Number,
    required: false,
    min: 0
  },
  status: {
    type: String,
    required: true,
    enum: ['Pass', 'Fail'],
    default: 'Pass'
  },
  technician: {
    type: String,
    required: true,
    trim: true
  },
  nextCalibration: {
    type: String,
    required: false,
    default: 'On change of Filter Holder model'
  },
  notes: {
    type: String,
    trim: true
  },
  calibratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
efaCalibrationSchema.index({ calibrationId: 1 });
efaCalibrationSchema.index({ filterHolderModel: 1 });
efaCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model('EFACalibration', efaCalibrationSchema);
