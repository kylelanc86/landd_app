const mongoose = require('mongoose');

const variableCalibrationFrequencySchema = new mongoose.Schema({
  equipmentType: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  calibrationRequirements: {
    type: String,
    required: true,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
variableCalibrationFrequencySchema.index({ equipmentType: 1 });
variableCalibrationFrequencySchema.index({ createdBy: 1 });
variableCalibrationFrequencySchema.index({ updatedBy: 1 });

module.exports = mongoose.model('VariableCalibrationFrequency', variableCalibrationFrequencySchema);
