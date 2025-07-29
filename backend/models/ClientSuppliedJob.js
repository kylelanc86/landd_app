const mongoose = require('mongoose');

const clientSuppliedJobSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  jobNumber: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['In Progress', 'Completed'],
    default: 'In Progress'
  },
  analyst: {
    type: String,
    trim: true
  },
  analysisDate: {
    type: Date
  },
  sampleCount: {
    type: Number,
    default: 0
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
clientSuppliedJobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create indexes
clientSuppliedJobSchema.index({ projectId: 1 });
clientSuppliedJobSchema.index({ jobNumber: 1 });
clientSuppliedJobSchema.index({ status: 1 });

module.exports = mongoose.model('ClientSuppliedJob', clientSuppliedJobSchema); 