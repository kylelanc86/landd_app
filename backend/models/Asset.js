const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetReference: {
    type: String,
    required: true,
    trim: true
  },
  assetDescription: {
    type: String,
    required: true,
    trim: true
  },
  electrical: {
    type: String,
    enum: ['yes', 'no'],
    required: true
  },
  testAndTagDate: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
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
});

assetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

assetSchema.index({ assetReference: 1 });
assetSchema.index({ status: 1 });

module.exports = mongoose.model('Asset', assetSchema);
