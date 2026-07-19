const mongoose = require('mongoose');

const riLiquidBottleSchema = new mongoose.Schema({
  bottleId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  refractiveIndex: {
    type: Number,
    required: true,
    enum: [1.55, 1.67, 1.70]
  },
  batchNumber: {
    type: String,
    required: true,
    trim: true
  },
  dateOpened: {
    type: Date,
    required: true
  },
  isEmpty: {
    type: Boolean,
    default: false
  },
  dateEmptied: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

riLiquidBottleSchema.index({ isEmpty: 1, refractiveIndex: 1 });

module.exports = mongoose.model('RiLiquidBottle', riLiquidBottleSchema);
