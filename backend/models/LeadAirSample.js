const mongoose = require('mongoose');

/**
 * Lead air monitoring samples - separate collection from general Sample (asbestos).
 * Allows lead-specific fields (e.g. leadContent in μg/filter) without polluting
 * the shared Sample schema.
 */
const leadAirSampleSchema = new mongoose.Schema({
  shift: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift',
    required: true
  },
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeadRemovalJob',
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
  type: {
    type: String,
    enum: ['Background', 'Clearance', 'Exposure', '-'],
    required: false
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
  startTime: {
    type: String,
    required: false
  },
  endTime: {
    type: String,
    required: false
  },
  nextDay: {
    type: Boolean,
    default: false
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
  // Lead-specific: result in micrograms per filter (μg/filter)
  leadContent: {
    type: String,
    required: false
  },
  // Lead-specific: concentration (e.g. μg/m³)
  leadConcentration: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { collection: 'lead_air_samples' });

leadAirSampleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

leadAirSampleSchema.index({ shift: 1, fullSampleID: 1 });
leadAirSampleSchema.index({ shift: 1 });
leadAirSampleSchema.index({ job: 1 });

module.exports = mongoose.model('LeadAirSample', leadAirSampleSchema);
