const mongoose = require('mongoose');

const riLiquidCalibrationSchema = new mongoose.Schema({
  bottleId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  refractiveIndex: {
    type: Number,
    required: true,
    min: 0
  },
  asbestosTypeVerified: {
    type: String,
    enum: ['Chrysotile', 'Amosite', 'Crocidolite'],
    required: true
  },
  dateOpened: {
    type: Date,
    required: true
  },
  batchNumber: {
    type: String,
    required: true,
    trim: true
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
  },
  isEmpty: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate status and next calibration date
riLiquidCalibrationSchema.pre('save', async function(next) {
  // Auto-calculate status based on refractive index and asbestos type
  if (this.refractiveIndex !== undefined && this.asbestosTypeVerified) {
    const passCombinations = [
      { refractiveIndex: 1.55, asbestosType: 'Chrysotile' },
      { refractiveIndex: 1.67, asbestosType: 'Amosite' },
      { refractiveIndex: 1.70, asbestosType: 'Crocidolite' }
    ];
    
    const isPass = passCombinations.some(combo => 
      Math.abs(this.refractiveIndex - combo.refractiveIndex) < 0.001 && 
      this.asbestosTypeVerified === combo.asbestosType
    );
    
    this.status = isPass ? 'Pass' : 'Fail';
  }

  // Calculate next calibration date - default to 6 months for RI Liquids
  // Only calculate if nextCalibration is not already set
  // Use dateOpened instead of date for next calibration calculation
  const dateForCalculation = this.dateOpened || this.date;
  if (dateForCalculation && !this.nextCalibration) {
    try {
      const CalibrationFrequency = mongoose.model('CalibrationFrequency');
      
      // Try to get calibration frequency from CalibrationFrequency model
      const calibrationFreqConfig = await CalibrationFrequency.findOne({ 
        equipmentType: 'RI Liquids' 
      });
      
      let frequencyInMonths = 6; // Default to 6 months
      
      if (calibrationFreqConfig) {
        // Convert to months if needed
        if (calibrationFreqConfig.frequencyUnit === 'years') {
          frequencyInMonths = calibrationFreqConfig.frequencyValue * 12;
        } else {
          frequencyInMonths = calibrationFreqConfig.frequencyValue;
        }
      }
      
      const nextDue = new Date(dateForCalculation);
      nextDue.setMonth(nextDue.getMonth() + frequencyInMonths);
      this.nextCalibration = nextDue;
    } catch (error) {
      console.error('Error calculating next calibration date for RI Liquid:', error);
      // Default to 6 months if calculation fails
      const nextDue = new Date(dateForCalculation);
      nextDue.setMonth(nextDue.getMonth() + 6);
      this.nextCalibration = nextDue;
    }
  }

  next();
});

// Index for efficient querying
riLiquidCalibrationSchema.index({ bottleId: 1, date: -1 });
riLiquidCalibrationSchema.index({ calibratedBy: 1 });
riLiquidCalibrationSchema.index({ status: 1 });

module.exports = mongoose.model('RiLiquidCalibration', riLiquidCalibrationSchema);
