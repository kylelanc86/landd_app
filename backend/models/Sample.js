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
    required: true
  },
  location: {
    type: String,
    required: true
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
    required: true
  },
  endTime: {
    type: String,
    required: false
  },
  initialFlowrate: {
    type: Number,
    required: true
  },
  finalFlowrate: {
    type: Number,
    required: false
  },
  averageFlowrate: {
    type: Number,
    required: true
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
    required: true
  },
  results: {
    type: Map,
    of: Number
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