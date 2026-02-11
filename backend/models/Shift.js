const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'jobModel',
    required: true
  },
  jobModel: {
    type: String,
    enum: ['AirMonitoringJob', 'AsbestosRemovalJob'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  supervisor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  defaultSampler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  defaultFlowmeter: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['ongoing', 'sampling_complete', 'samples_submitted_to_lab', 'analysis_complete', 'shift_complete'],
    default: 'ongoing'
  },
  samples: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sample'
  }],
  sampleNumbers: [{
    type: String
  }],
  submittedBy: {
    type: String,
    required: false
  },
  samplesReceivedDate: {
    type: Date,
    required: false
  },
  analysedBy: {
    type: String,
    required: false
  },
  analysisDate: {
    type: Date,
    required: false
  },
  reportApprovedBy: {
    type: String,
    required: false
  },
  reportIssueDate: {
    type: Date,
    required: false
  },
  authorisationRequestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  authorisationRequestedByEmail: {
    type: String,
    required: false
  },
  reportViewedAt: {
    type: Date,
    required: false
  },
  descriptionOfWorks: {
    type: String,
    required: false
  },
  notes: {
    type: String
  },
  revision: {
    type: Number,
    default: 0,
    min: 0
  },
  sitePlan: {
    type: Boolean,
    default: false
  },
  sitePlanData: {
    type: {
      center: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
      },
      zoom: { type: Number, default: 15 },
      markers: [{
        position: {
          lat: { type: Number, required: true },
          lng: { type: Number, required: true }
        },
        label: { type: String, default: 'X' },
        type: { 
          type: String, 
          enum: ['sampling_point', 'equipment', 'access_point', 'other'],
          default: 'sampling_point'
        },
        description: { type: String }
      }],
      bounds: {
        north: { type: Number },
        south: { type: Number },
        east: { type: Number },
        west: { type: Number }
      },
      staticMapUrl: { type: String }
    },
    required: false
  }
}, {
  timestamps: true,
  collection: 'air_monitoring_shifts'
});

// Index for better query performance
shiftSchema.index({ job: 1 });

// Add pre-find middleware to log queries
shiftSchema.pre('find', function() {
  console.log('Shift find query:', this.getQuery());
});

shiftSchema.pre('findOne', function() {
  console.log('Shift findOne query:', this.getQuery());
});

// Add pre-save middleware to log validation errors
shiftSchema.pre('save', function(next) {
  console.log('Saving shift with data:', this.toObject());
  const validationError = this.validateSync();
  if (validationError) {
    console.error('Validation error:', validationError);
  }
  next();
});

// Add error handling for population
shiftSchema.post('find', function(error, doc, next) {
  if (error) {
    console.error('Error in Shift find:', error);
  }
  next(error);
});

shiftSchema.post('findOne', function(error, doc, next) {
  if (error) {
    console.error('Error in Shift findOne:', error);
  }
  next(error);
});

module.exports = mongoose.model('Shift', shiftSchema); 