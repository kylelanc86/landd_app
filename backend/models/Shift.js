const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'jobModel',
    required: true
  },
  jobModel: {
    type: String,
    enum: ['AsbestosRemovalJob', 'LeadRemovalJob'],
    default: 'AsbestosRemovalJob',
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
  /** Frozen authorised filename without .pdf / revX (set on first authorisation). */
  reportReference: {
    type: String,
    required: false
  },
  /** Option B same-day sequence among asbestos air monitoring reports for the project. */
  sequenceNumber: {
    type: Number,
    required: false,
    min: 1
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
  analysisTurnaroundDate: {
    type: String,
    required: false
  },
  analysisTurnaroundType: {
    type: String,
    required: false
  },
  notes: {
    type: String
  },
  analysisReportPath: {
    type: String,
    required: false
  },
  // Lead analysis report PDF stored in MongoDB as base64 data (same pattern as asbestos fibre analysis reports)
  // Keep excluded from normal queries to avoid large payloads in shift list/detail APIs.
  analysisReportData: {
    type: String,
    required: false,
    select: false
  },
  analysisReportOriginalName: {
    type: String,
    required: false
  },
  // Multiple lead analysis report PDFs (ordered); legacy single-report fields above are migrated on read.
  analysisReports: {
    type: [
      {
        originalName: { type: String, required: true },
        data: { type: String, required: true, select: false },
      },
    ],
    default: undefined,
  },
  revision: {
    type: Number,
    default: 0,
    min: 0
  },
  deletedAt: {
    type: Date,
    required: false,
    default: null
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
        description: { type: String },
        sampleNumber: { type: String }
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

function attachAnalysisReportFilesMetadata(ret) {
  if (!ret || typeof ret !== 'object') return ret;
  const reports = Array.isArray(ret.analysisReports) ? ret.analysisReports : [];
  if (reports.length > 0) {
    ret.analysisReportFiles = reports.map((r) => ({
      id: r._id,
      originalName: r.originalName,
    }));
  } else if (ret.analysisReportPath) {
    ret.analysisReportFiles = [
      {
        id: 'legacy',
        originalName: ret.analysisReportOriginalName || 'analysis-report.pdf',
      },
    ];
  } else {
    ret.analysisReportFiles = [];
  }
  delete ret.analysisReports;
  delete ret.analysisReportData;
  return ret;
}

shiftSchema.set('toJSON', {
  transform(_doc, ret) {
    return attachAnalysisReportFilesMetadata(ret);
  },
});

shiftSchema.set('toObject', {
  transform(_doc, ret) {
    return attachAnalysisReportFilesMetadata(ret);
  },
});

module.exports = mongoose.model('Shift', shiftSchema); 