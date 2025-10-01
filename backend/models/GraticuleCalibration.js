const mongoose = require('mongoose');

const graticuleCalibrationSchema = new mongoose.Schema({
  calibrationId: {
    type: String,
    required: false,
    trim: true,
    unique: true,
    sparse: true // Allows multiple null values
  },
  graticuleId: {
    type: String,
    required: true,
    trim: true
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
graticuleCalibrationSchema.pre('save', async function(next) {
  // Calculate next calibration due date using the equipment's calibration frequency
  if (this.date && this.graticuleId) {
    try {
      const Equipment = mongoose.model('Equipment');
      const equipment = await Equipment.findOne({ equipmentReference: this.graticuleId });
      
      if (equipment && equipment.calibrationFrequency) {
        const nextDue = new Date(this.date);
        nextDue.setMonth(nextDue.getMonth() + equipment.calibrationFrequency);
        this.nextCalibration = nextDue;
      }
    } catch (error) {
      // If lookup fails, fall back to 12 months
      const nextDue = new Date(this.date);
      nextDue.setMonth(nextDue.getMonth() + 12);
      this.nextCalibration = nextDue;
    }
  }

  next();
});

// Index for efficient querying
graticuleCalibrationSchema.index({ calibrationId: 1 });
graticuleCalibrationSchema.index({ graticuleId: 1 });
graticuleCalibrationSchema.index({ date: -1 });
graticuleCalibrationSchema.index({ microscopeId: 1 });
graticuleCalibrationSchema.index({ status: 1 });
graticuleCalibrationSchema.index({ technician: 1 });
graticuleCalibrationSchema.index({ calibratedBy: 1 });

module.exports = mongoose.model('GraticuleCalibration', graticuleCalibrationSchema);
