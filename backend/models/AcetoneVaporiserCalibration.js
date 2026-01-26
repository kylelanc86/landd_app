const mongoose = require('mongoose');

const acetoneVaporiserCalibrationSchema = new mongoose.Schema({
  vaporiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  temperature: {
    type: Number,
    required: true,
    min: 0,
    max: 200
  },
  status: {
    type: String,
    enum: ['Pass', 'Fail'],
    required: true
  },
  calibratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  nextCalibration: {
    type: Date,
    required: false
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate status and next calibration date
acetoneVaporiserCalibrationSchema.pre('save', async function(next) {
  // Calculate status based on temperature (Pass mark is between 65 and 100 degrees C)
  if (this.temperature !== undefined && this.temperature !== null) {
    if (this.temperature >= 65 && this.temperature <= 100) {
      this.status = 'Pass';
    } else {
      this.status = 'Fail';
    }
  }

  // Calculate next calibration date using calibration frequency configuration
  // Only calculate if nextCalibration is not already set
  if (this.date && this.vaporiserId && !this.nextCalibration) {
    try {
      const Equipment = mongoose.model('Equipment');
      const CalibrationFrequency = mongoose.model('CalibrationFrequency');
      
      // Get the equipment to find its equipmentType
      const equipment = await Equipment.findById(this.vaporiserId);
      
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
      console.error('Error calculating next calibration date for acetone vaporiser:', error);
      // Don't set nextCalibration if calculation fails
    }
  }

  next();
});

// Index for efficient querying
acetoneVaporiserCalibrationSchema.index({ vaporiserId: 1, date: -1 });
acetoneVaporiserCalibrationSchema.index({ calibratedBy: 1 });
acetoneVaporiserCalibrationSchema.index({ status: 1 });

module.exports = mongoose.model('AcetoneVaporiserCalibration', acetoneVaporiserCalibrationSchema);
