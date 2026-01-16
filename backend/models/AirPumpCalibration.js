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
  flowmeterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    required: false
  },
  nextCalibrationDue: {
    type: Date
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate percent error and pass/fail status
airPumpCalibrationSchema.pre('save', function(next) {
  // Only recalculate if testResults exist and is an array
  if (this.testResults && Array.isArray(this.testResults) && this.testResults.length > 0) {
    // Calculate percent error and pass/fail for each test result
    this.testResults.forEach(result => {
      if (result.setFlowrate && result.actualFlowrate !== undefined) {
        result.percentError = Math.abs(((result.actualFlowrate - result.setFlowrate) / result.setFlowrate) * 100);
        result.passed = result.percentError < 5;
      }
    });

    // Determine overall result - pass if at least one test passed
    const atLeastOnePassed = this.testResults.some(result => result.passed === true);
    this.overallResult = atLeastOnePassed ? 'Pass' : 'Fail';
    
    // Debug logging
    console.log('Pre-save hook - Calculating overallResult:', {
      testResultsCount: this.testResults.length,
      testResults: this.testResults.map(tr => ({
        setFlowrate: tr.setFlowrate,
        actualFlowrate: tr.actualFlowrate,
        percentError: tr.percentError,
        passed: tr.passed
      })),
      atLeastOnePassed: atLeastOnePassed,
      overallResult: this.overallResult,
      previousOverallResult: this.isNew ? 'N/A (new)' : this.get('overallResult')
    });
  } else {
    // If no test results, keep existing overallResult or set to Fail
    if (!this.overallResult) {
      this.overallResult = 'Fail';
    }
    console.log('Pre-save hook - No test results, overallResult:', this.overallResult);
  }

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