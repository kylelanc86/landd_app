const mongoose = require('mongoose');

const calibrationFrequencySchema = new mongoose.Schema({
  equipmentType: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  frequencyValue: {
    type: Number,
    required: true,
    min: 1,
    max: 999
  },
  frequencyUnit: {
    type: String,
    required: true,
    enum: ['months', 'years']
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
calibrationFrequencySchema.index({ equipmentType: 1 });
calibrationFrequencySchema.index({ createdBy: 1 });
calibrationFrequencySchema.index({ updatedBy: 1 });

module.exports = mongoose.model('CalibrationFrequency', calibrationFrequencySchema);
