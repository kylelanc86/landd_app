const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AirMonitoringJob',
    required: true
  },
  sampleNumber: {
    type: String,
    required: true
  },
  fullSampleID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['Background', 'Clearance', 'Exposure'],
    required: false
  },
  location: {
    type: String,
    required: false
  },
  pumpNo: {
    type: String,
    required: false
  },
  cowlNo: {
    type: String,
    required: false
  },
  filterSize: {
    type: String,
    required: false
  },
  startTime: {
    type: String,
    required: false
  },
  endTime: {
    type: String,
    required: false
  },
  initialFlowrate: {
    type: Number,
    required: false
  },
  finalFlowrate: {
    type: Number,
    required: false
  },
  averageFlowrate: {
    type: Number,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'at_lab', 'analyzed', 'completed'],
    default: 'pending'
  },
  notes: String,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  analysis: {
    microscope: String,
    testSlide: String,
    testSlideLines: String,
    edgesDistribution: String,
    backgroundDust: String,
    fibresCounted: Number,
    fieldsCounted: Number,
    reportedConcentration: Number
  },
  analyzedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
sampleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Sample', sampleSchema); 