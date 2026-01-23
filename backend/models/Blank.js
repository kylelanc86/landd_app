const mongoose = require('mongoose');

const blankSchema = new mongoose.Schema({
  blankDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pass', 'Fail', 'N/A'],
    default: 'N/A'
  },
  analysis: {
    microscope: String,
    testSlide: String,
    testSlideLines: String,
    edgesDistribution: String,
    backgroundDust: String,
    uncountableDueToDust: {
      type: Boolean,
      default: false
    },
    fibreCounts: [[Number]],
    fibresCounted: mongoose.Schema.Types.Mixed, // Can be Number or String ('-')
    fieldsCounted: mongoose.Schema.Types.Mixed, // Can be Number or String ('-')
    reportedConcentration: String,
    comment: String
  },
  analysedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
blankSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
blankSchema.index({ blankDate: -1 });
blankSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Blank', blankSchema);
