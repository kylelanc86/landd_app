const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AirMonitoringJob',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['ongoing', 'sampling_complete', 'samples_submitted_to_lab', 'analysis_complete', 'shift_complete'],
    default: 'ongoing'
  },
  samplesReceivedDate: {
    type: Date,
    required: false
  },
  analysedBy: {
    type: String,
    required: false
  },
  analysisDate: {
    type: Date,
    required: false
  },
  reportApprovedBy: {
    type: String,
    required: false
  },
  reportIssueDate: {
    type: Date,
    required: false
  },
  descriptionOfWorks: {
    type: String,
    required: false
  },
  notes: {
    type: String
  }
}, {
  timestamps: true,
  collection: 'air_monitoring_shifts'
});

module.exports = mongoose.model('Shift', shiftSchema); 