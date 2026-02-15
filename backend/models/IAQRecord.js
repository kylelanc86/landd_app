const mongoose = require('mongoose');

const iaqRecordSchema = new mongoose.Schema({
  monitoringDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['In Progress', 'Sampling Complete', 'Samples Submitted to Lab', 'Complete - Satisfactory', 'Complete - Failed'],
    default: 'In Progress'
  },
  samples: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IAQSample'
  }],
  reportApprovedBy: {
    type: String,
    required: false
  },
  reportIssueDate: {
    type: Date,
    required: false
  },
  authorisationRequestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  authorisationRequestedByEmail: {
    type: String,
    required: false
  },
  reportViewedAt: {
    type: Date,
    required: false
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
iaqRecordSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
iaqRecordSchema.index({ monitoringDate: -1 });
iaqRecordSchema.index({ status: 1 });

module.exports = mongoose.model('IAQRecord', iaqRecordSchema);
