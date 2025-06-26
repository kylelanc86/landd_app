const mongoose = require('mongoose');

const airPumpSchema = new mongoose.Schema({
  pumpReference: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  pumpDetails: {
    type: String,
    required: true,
    trim: true
  },
  calibrationDate: {
    type: Date,
    required: true
  },
  calibrationDue: {
    type: Date,
    required: true
  },
  maxFlowrate: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Maintenance', 'Retired', 'Out of Service'],
    default: 'Active'
  },
  notes: {
    type: String,
    trim: true
  },
  lastCalibratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  manufacturer: {
    type: String,
    trim: true
  },
  model: {
    type: String,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  purchaseDate: {
    type: Date
  },
  warrantyExpiry: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
airPumpSchema.index({ pumpReference: 1 });
airPumpSchema.index({ status: 1 });
airPumpSchema.index({ calibrationDue: 1 });

// Virtual for checking if calibration is overdue
airPumpSchema.virtual('isCalibrationOverdue').get(function() {
  return this.calibrationDue < new Date();
});

// Virtual for days until calibration due
airPumpSchema.virtual('daysUntilCalibration').get(function() {
  const today = new Date();
  const due = new Date(this.calibrationDue);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to get calibration status
airPumpSchema.methods.getCalibrationStatus = function() {
  const daysUntil = this.daysUntilCalibration;
  
  if (daysUntil < 0) {
    return { status: 'Overdue', color: 'error' };
  } else if (daysUntil <= 30) {
    return { status: 'Due Soon', color: 'warning' };
  } else {
    return { status: 'Valid', color: 'success' };
  }
};

// Pre-save middleware to ensure pumpReference is uppercase
airPumpSchema.pre('save', function(next) {
  if (this.pumpReference) {
    this.pumpReference = this.pumpReference.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('AirPump', airPumpSchema); 