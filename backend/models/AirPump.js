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
    enum: ['Active', 'Out of Service'],
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

// Pre-save middleware to ensure pumpReference is uppercase and calculate calibration due date
airPumpSchema.pre('save', function(next) {
  if (this.pumpReference) {
    this.pumpReference = this.pumpReference.toUpperCase();
  }
  
  // Parse and set calibration date if it's a string
  if (this.calibrationDate && typeof this.calibrationDate === 'string') {
    // Handle dd/mm/yyyy format
    const dateParts = this.calibrationDate.split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
      const year = parseInt(dateParts[2]);
      this.calibrationDate = new Date(year, month, day);
    } else {
      // Try standard date parsing
      this.calibrationDate = new Date(this.calibrationDate);
    }
  }
  
  // Calculate calibration due date as one year after calibration date
  if (this.calibrationDate) {
    const dueDate = new Date(this.calibrationDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);
    this.calibrationDue = dueDate;
  }
  
  next();
});

// Static method to fix existing data with date parsing issues
airPumpSchema.statics.fixDateIssues = async function() {
  const pumps = await this.find({});
  let updatedCount = 0;
  
  for (const pump of pumps) {
    let needsUpdate = false;
    
    // Fix calibration date if it's a string
    if (pump.calibrationDate && typeof pump.calibrationDate === 'string') {
      const dateParts = pump.calibrationDate.split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1;
        const year = parseInt(dateParts[2]);
        pump.calibrationDate = new Date(year, month, day);
        needsUpdate = true;
      }
    }
    
    // Recalculate calibration due date
    if (pump.calibrationDate) {
      const dueDate = new Date(pump.calibrationDate);
      dueDate.setFullYear(dueDate.getFullYear() + 1);
      pump.calibrationDue = dueDate;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await pump.save();
      updatedCount++;
    }
  }
  
  return updatedCount;
};

module.exports = mongoose.model('AirPump', airPumpSchema); 