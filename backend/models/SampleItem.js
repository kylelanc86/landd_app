const mongoose = require('mongoose');

const sampleItemSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
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
    type: mongoose.Schema.Types.Mixed, // Can be ObjectId (User reference) or String (analyst name)
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
});

// Update the updatedAt timestamp before saving
sampleItemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create compound index for efficient queries
sampleItemSchema.index({ projectId: 1, labReference: 1 });
sampleItemSchema.index({ projectId: 1, createdAt: -1 });
sampleItemSchema.index({ labReference: 1 }, { unique: true });

module.exports = mongoose.model('SampleItem', sampleItemSchema); 