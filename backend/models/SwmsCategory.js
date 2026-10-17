const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema({
  probability: { type: Number, min: 1, max: 5 },
  severity: { type: Number, min: 1, max: 5 },
  score: { type: Number },
  rating: { type: String, trim: true, default: '' },
}, { _id: false });

const swmsItemSchema = new mongoose.Schema({
  itemNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  procedure: {
    type: String,
    trim: true,
    default: '',
    maxlength: 4000,
  },
  hazard: {
    type: String,
    trim: true,
    default: '',
    maxlength: 2000,
  },
  riskBefore: {
    type: riskSchema,
    default: () => ({}),
  },
  control: {
    type: String,
    trim: true,
    default: '',
    maxlength: 4000,
  },
  riskAfter: {
    type: riskSchema,
    default: () => ({}),
  },
  responsibility: {
    type: String,
    trim: true,
    default: '',
    maxlength: 500,
  },
});

const swmsCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  workTypes: {
    type: [String],
    default: [],
  },
  items: {
    type: [swmsItemSchema],
    default: [],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

swmsCategorySchema.index({ isActive: 1, name: 1 });

module.exports = mongoose.model('SwmsCategory', swmsCategorySchema);
