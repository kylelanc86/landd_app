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
    required: false,
    trim: true
  },
  graticuleArea: {
    type: Number,
    required: false,
    min: 0
  },
  constant25mm: {
    type: Number,
    required: false,
    min: 0
  },
  constant13mm: {
    type: Number,
    required: false,
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
  nextCalibration: {
    type: Date,
    required: false
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
pcmMicroscopeCalibrationSchema.pre('save', async function(next) {
  // Calculate next calibration due date using the calibration frequency configuration
  // Only calculate if nextCalibration is not already set
  if (this.date && this.microscopeReference && !this.nextCalibration) {
    try {
      const Equipment = mongoose.model('Equipment');
      const CalibrationFrequency = mongoose.model('CalibrationFrequency');
      
      // First, get the equipment to find its equipmentType
      const equipment = await Equipment.findOne({ equipmentReference: this.microscopeReference });
      
      if (equipment && equipment.equipmentType) {
        // Try to get calibration frequency from CalibrationFrequency model (preferred source)
        const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
          equipmentType: equipment.equipmentType 
        });
        
        let frequencyInMonths = null;
        
        if (calibrationFreqConfig) {
          // Convert to months if needed
          if (calibrationFreqConfig.frequencyUnit === 'years') {
            frequencyInMonths = calibrationFreqConfig.frequencyValue * 12;
          } else {
            frequencyInMonths = calibrationFreqConfig.frequencyValue;
          }
        } else if (equipment.calibrationFrequency) {
          // Fall back to equipment's calibrationFrequency field
          frequencyInMonths = equipment.calibrationFrequency;
        }
        
        if (frequencyInMonths) {
          const nextDue = new Date(this.date);
          nextDue.setMonth(nextDue.getMonth() + frequencyInMonths);
          this.nextCalibration = nextDue;
        }
      }
    } catch (error) {
      console.error('Error calculating next calibration date for PCM microscope:', error);
      // Don't set nextCalibration if calculation fails
    }
  }

  next();
});

// Index for efficient querying
pcmMicroscopeCalibrationSchema.index({ calibrationId: 1 });
pcmMicroscopeCalibrationSchema.index({ microscopeReference: 1 });

module.exports = mongoose.model('PCMMicroscopeCalibration', pcmMicroscopeCalibrationSchema);
