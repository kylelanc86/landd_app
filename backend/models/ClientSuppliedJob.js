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
  jobType: {
    type: String,
    enum: ['Fibre ID', 'Fibre Count'],
    default: 'Fibre ID'
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
  sampleReceiptDate: {
    type: Date
  },
  samples: [{
    labReference: {
      type: String,
      required: true,
      trim: true
    },
    clientReference: {
      type: String,
      required: true,
      trim: true
    },
    sampleDescription: {
      type: String,
      trim: true,
      default: ""
    },
    ashingReference: {
      type: String,
      trim: true,
      default: ""
    },
    analysisResult: {
      type: String,
      default: 'Pending'
    },
    analysisData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    analyzedBy: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'User'
    },
    analyzedAt: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
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