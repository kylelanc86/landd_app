const mongoose = require('mongoose');

const CustomDataFieldSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['asbestos_removalist', 'location_description', 'materials_description', 'room_area', 'legislation', 'project_status'],
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  legislationTitle: {
    type: String,
    trim: true
  },
  jurisdiction: {
    type: String,
    trim: true
  },
  isActiveStatus: {
    type: Boolean,
    default: true
  },
  statusColor: {
    type: String,
    trim: true,
    default: '#1976d2' // Default Material-UI primary blue
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure proper uniqueness:
// For legislation: unique on type + text + jurisdiction 
// For other types: unique on type + text
CustomDataFieldSchema.index({ type: 1, text: 1, jurisdiction: 1 }, { 
  unique: true,
  partialFilterExpression: { jurisdiction: { $exists: true } }
});

// General index for queries
CustomDataFieldSchema.index({ type: 1, text: 1 });

// Pre-save middleware to update updatedAt
CustomDataFieldSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CustomDataField', CustomDataFieldSchema);
