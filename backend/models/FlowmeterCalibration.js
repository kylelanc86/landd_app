const mongoose = require('mongoose');

const flowmeterCalibrationSchema = new mongoose.Schema({
  flowmeterId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  flowRate: {
    type: Number,
    required: true,
    min: 0
  },
  bubbleflowVolume: {
    type: String,
    required: true,
    enum: ['500', '1000']
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
  notes: {
    type: String,
    trim: true
  },
  runtime1: {
    type: Number,
    required: false,
    min: 0
  },
  runtime2: {
    type: Number,
    required: false,
    min: 0
  },
  runtime3: {
    type: Number,
    required: false,
    min: 0
  },
  averageRuntime: {
    type: Number,
    required: false,
    min: 0
  },
  equivalentFlowrate: {
    type: Number,
    required: false,
    min: 0
  },
  difference: {
    type: Number,
    required: false,
    min: 0
  },
  calibratedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to calculate average runtime, equivalent flowrate, and difference
flowmeterCalibrationSchema.pre('save', function(next) {
  // Calculate average runtime if all three runtimes are provided
  if (this.runtime1 && this.runtime2 && this.runtime3) {
    this.averageRuntime = ((this.runtime1 + this.runtime2 + this.runtime3) / 3);
  }

  // Calculate equivalent flowrate and difference if we have the required data
  if (this.flowRate && this.bubbleflowVolume && this.averageRuntime && this.averageRuntime > 0) {
    // Calculate expected time based on flow rate and volume
    const flowRateNum = parseFloat(this.flowRate);
    const volume = parseFloat(this.bubbleflowVolume); // 500 or 1000
    const expectedTime = (volume / (flowRateNum * 1000)) * 60; // in seconds

    // Calculate equivalent flowrate: (expected time / average runtime) * flowrate * 1000
    // This gives mL/min
    this.equivalentFlowrate = (expectedTime / this.averageRuntime) * flowRateNum * 1000;

    // Calculate difference: |((equivalent flowrate (mL/min) - flowrate (mL/min)) / flowrate (mL/min)) * 100|
    const flowRateMlMin = flowRateNum * 1000; // convert to mL/min
    if (flowRateMlMin !== 0) {
      this.difference = Math.abs(((this.equivalentFlowrate - flowRateMlMin) / flowRateMlMin) * 100);
    }
  }

  next();
});

// Index for efficient querying
flowmeterCalibrationSchema.index({ flowmeterId: 1, date: -1 });
flowmeterCalibrationSchema.index({ calibratedBy: 1 });
flowmeterCalibrationSchema.index({ status: 1 });
flowmeterCalibrationSchema.index({ date: -1 });

module.exports = mongoose.model('FlowmeterCalibration', flowmeterCalibrationSchema);
