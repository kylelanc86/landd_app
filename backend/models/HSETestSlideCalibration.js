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
hseTestSlideCalibrationSchema.pre('save', async function(next) {
  // Calculate next calibration due date using the calibration frequency configuration
  // Only calculate if nextCalibration is not already set
  if (this.date && this.testSlideReference && !this.nextCalibration) {
    try {
      const Equipment = mongoose.model('Equipment');
      const CalibrationFrequency = mongoose.model('CalibrationFrequency');
      
      // First, get the equipment to find its equipmentType
      const equipment = await Equipment.findOne({ equipmentReference: this.testSlideReference });
      
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
        } else {
          // If lookup fails or no frequency set, fall back to 60 months (5 years)
          const nextDue = new Date(this.date);
          nextDue.setMonth(nextDue.getMonth() + 60);
          this.nextCalibration = nextDue;
        }
      } else {
        // If equipment not found, fall back to 60 months (5 years)
        const nextDue = new Date(this.date);
        nextDue.setMonth(nextDue.getMonth() + 60);
        this.nextCalibration = nextDue;
      }
    } catch (error) {
      // If lookup fails, fall back to 60 months (5 years)
      const nextDue = new Date(this.date);
      nextDue.setMonth(nextDue.getMonth() + 60);
      this.nextCalibration = nextDue;
    }
  }

  next();
});

// Index for efficient querying
hseTestSlideCalibrationSchema.index({ calibrationId: 1 });
hseTestSlideCalibrationSchema.index({ testSlideReference: 1 });

module.exports = mongoose.model('HSETestSlideCalibration', hseTestSlideCalibrationSchema);

