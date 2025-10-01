const mongoose = require('mongoose');

const archivedGraticuleCalibrationSchema = new mongoose.Schema({
  calibrationId: {
    type: String,
    required: false,
    trim: true
  },
  graticuleId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
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
  },
  // Metadata for archiving
  archivedAt: {
    type: Date,
    default: Date.now
  },
  reasonForArchiving: {
    type: String,
    enum: ['new_calibration', 'equipment_retired', 'manual_archive'],
    default: 'new_calibration'
  }
}, {
  timestamps: true
});

// Index for efficient querying
archivedGraticuleCalibrationSchema.index({ calibrationId: 1 });
archivedGraticuleCalibrationSchema.index({ graticuleId: 1 });
archivedGraticuleCalibrationSchema.index({ date: -1 });
archivedGraticuleCalibrationSchema.index({ archivedAt: -1 });
archivedGraticuleCalibrationSchema.index({ status: 1 });
archivedGraticuleCalibrationSchema.index({ technician: 1 });

module.exports = mongoose.model('ArchivedGraticuleCalibration', archivedGraticuleCalibrationSchema);
