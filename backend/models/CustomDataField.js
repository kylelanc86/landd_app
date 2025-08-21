const mongoose = require('mongoose');

const CustomDataFieldSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['asbestos_removalist', 'location_description', 'materials_description', 'room_area'],
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true
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

// Compound index to ensure unique text per type
CustomDataFieldSchema.index({ type: 1, text: 1 }, { unique: true });

// Pre-save middleware to update updatedAt
CustomDataFieldSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CustomDataField', CustomDataFieldSchema);
