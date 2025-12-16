const mongoose = require('mongoose');

const hseTestSlideCalibrationSchema = new mongoose.Schema({
  calibrationId: {
    type: String,
    required: false,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values
  },
  testSlideReference: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  calibrationCompany: {
    type: String,
    required: true,
    trim: true
  },
  certificateNumber: {
    type: String,
    required: false,
    trim: true
  },
  certificateUrl: {
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
hseTestSlideCalibrationSchema.index({ calibrationId: 1 });
hseTestSlideCalibrationSchema.index({ testSlideReference: 1 });

module.exports = mongoose.model('HSETestSlideCalibration', hseTestSlideCalibrationSchema);

