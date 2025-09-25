const mongoose = require('mongoose');

const graticuleCalibrationSchema = new mongoose.Schema({
  graticuleId: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  scale: {
    type: String,
    required: true,
    trim: true
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
    type: Date,
    required: true
  },
  microscopeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    required: false
  },
  microscopeReference: {
    type: String,
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

// Pre-save middleware to calculate next calibration date
graticuleCalibrationSchema.pre('save', function(next) {
  // Calculate next calibration due date (6 months from calibration date)
  if (this.date) {
    const nextDue = new Date(this.date);
    nextDue.setMonth(nextDue.getMonth() + 6);
    this.nextCalibration = nextDue;
  }

  next();
});

// Index for efficient querying
graticuleCalibrationSchema.index({ graticuleId: 1 });
graticuleCalibrationSchema.index({ date: -1 });
graticuleCalibrationSchema.index({ microscopeId: 1 });
graticuleCalibrationSchema.index({ status: 1 });
graticuleCalibrationSchema.index({ technician: 1 });
graticuleCalibrationSchema.index({ calibratedBy: 1 });

module.exports = mongoose.model('GraticuleCalibration', graticuleCalibrationSchema);
