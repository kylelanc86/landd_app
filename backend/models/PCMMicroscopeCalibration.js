const mongoose = require('mongoose');

const pcmMicroscopeCalibrationSchema = new mongoose.Schema({
  calibrationId: {
    type: String,
    required: false,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values
  },
  microscopeReference: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  servicingCompany: {
    type: String,
    required: true,
    trim: true
  },
  graticule: {
    type: String,
    required: true,
    trim: true
  },
  graticuleArea: {
    type: Number,
    required: false,
    min: 0
  },
  constant25mm: {
    type: Number,
    required: true,
    min: 0
  },
  constant13mm: {
    type: Number,
    required: true,
    min: 0
  },
  serviceReportUrl: {
    type: String,
    required: false,
    trim: true
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
pcmMicroscopeCalibrationSchema.index({ calibrationId: 1 });
pcmMicroscopeCalibrationSchema.index({ microscopeReference: 1 });

module.exports = mongoose.model('PCMMicroscopeCalibration', pcmMicroscopeCalibrationSchema);
