const mongoose = require('mongoose');

const airPumpCalibrationSchema = new mongoose.Schema({
  pumpId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AirPump',
    required: true
  },
  calibrationDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  calibratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  testResults: [{
    setFlowrate: {
      type: Number,
      required: true,
      enum: [1000, 1500, 2000, 3000, 4000]
    },
    actualFlowrate: {
      type: Number,
      required: true
    },
    percentError: {
      type: Number,
      required: true
    },
    passed: {
      type: Boolean,
      required: true
    }
  }],
  overallResult: {
    type: String,
    enum: ['Pass', 'Fail']
  },
  notes: {
    type: String,
    trim: true
  },
  nextCalibrationDue: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate percent error and pass/fail status
airPumpCalibrationSchema.pre('save', function(next) {
  // Calculate percent error and pass/fail for each test result
  this.testResults.forEach(result => {
    result.percentError = Math.abs(((result.actualFlowrate - result.setFlowrate) / result.setFlowrate) * 100);
    result.passed = result.percentError < 5;
  });

  // Determine overall result - pass if all tests passed
  const allPassed = this.testResults.every(result => result.passed);
  this.overallResult = allPassed ? 'Pass' : 'Fail';

  // Calculate next calibration due date (1 year from calibration date)
  if (this.calibrationDate) {
    const nextDue = new Date(this.calibrationDate);
    nextDue.setFullYear(nextDue.getFullYear() + 1);
    this.nextCalibrationDue = nextDue;
  }

  next();
});

// Virtual for average percent error
airPumpCalibrationSchema.virtual('averagePercentError').get(function() {
  if (this.testResults.length === 0) return 0;
  const totalError = this.testResults.reduce((sum, result) => sum + result.percentError, 0);
  return totalError / this.testResults.length;
});

// Virtual for number of tests passed
airPumpCalibrationSchema.virtual('testsPassed').get(function() {
  return this.testResults.filter(result => result.passed).length;
});

// Virtual for total number of tests
airPumpCalibrationSchema.virtual('totalTests').get(function() {
  return this.testResults.length;
});

// Index for efficient querying
airPumpCalibrationSchema.index({ pumpId: 1, calibrationDate: -1 });
airPumpCalibrationSchema.index({ calibratedBy: 1 });
airPumpCalibrationSchema.index({ overallResult: 1 });

module.exports = mongoose.model('AirPumpCalibration', airPumpCalibrationSchema); 