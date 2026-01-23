const mongoose = require('mongoose');

const iaqSampleSchema = new mongoose.Schema({
  iaqRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IAQRecord',
    required: true
  },
  sampleNumber: {
    type: String,
    required: true
  },
  fullSampleID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  location: {
    type: String,
    required: false
  },
  pumpNo: {
    type: String,
    required: false
  },
  flowmeter: {
    type: String,
    required: false
  },
  cowlNo: {
    type: String,
    required: false
  },
  sampler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  filterSize: {
    type: String,
    required: false
  },
  startTime: {
    type: String,
    required: false
  },
  endTime: {
    type: String,
    required: false
  },
  initialFlowrate: {
    type: Number,
    required: false
  },
  finalFlowrate: {
    type: Number,
    required: false
  },
  averageFlowrate: {
    type: Number,
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'at_lab', 'analysed', 'completed', 'failed'],
    default: 'pending'
  },
  notes: String,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  isFieldBlank: {
    type: Boolean,
    default: false
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
    reportedConcentration: String
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
iaqSampleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
iaqSampleSchema.index({ iaqRecord: 1, fullSampleID: 1 });
iaqSampleSchema.index({ iaqRecord: 1 });

module.exports = mongoose.model('IAQSample', iaqSampleSchema);
