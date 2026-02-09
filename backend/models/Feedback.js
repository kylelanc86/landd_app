const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  feedbackDescription: {
    type: String,
    required: true,
    trim: true
  },
  feedbackType: {
    type: String,
    required: true,
    enum: ['positive', 'negative']
  },
  nonConformance: {
    type: String,
    enum: ['yes', 'no', ''],
    default: ''
  },
  nonConformanceReference: {
    type: String,
    trim: true,
    default: null
  },
  receivedBy: {
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
});

feedbackSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

feedbackSchema.index({ date: -1 });
feedbackSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
