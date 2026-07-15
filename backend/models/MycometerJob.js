const mongoose = require('mongoose');

const SAMPLE_TYPES = [
  'Surface Fungi',
  'Air Fungi',
  'Air Allergen',
  'Air FAI',
];

const CLEANING_STAGES = ['Before Cleaning', 'After Cleaning'];

const YES_NO_OPTIONS = ['Yes', 'No'];

const TURNAROUND_OPTIONS = ['3 day', '24 hours', 'custom'];

const mycometerJobSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    scopeOfWorks: {
      type: [
        {
          type: String,
          enum: SAMPLE_TYPES,
        },
      ],
      default: [],
    },
    // Shared fields per sample type (Sampled by, Sample Date, sampling complete, etc.)
    samplingMeta: [
      {
        sampleType: {
          type: String,
          enum: SAMPLE_TYPES,
          required: true,
        },
        sampledBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        // Immutable display name captured when sampler is set/updated
        sampledByName: {
          type: String,
          trim: true,
        },
        // Snapshot of Surface/Air Mycometer cert at the time sampler was set
        mycometerCertificationNumber: {
          type: String,
          trim: true,
        },
        sampleDate: {
          type: Date,
        },
        samplingComplete: {
          type: Boolean,
          default: false,
        },
        turnaroundTime: {
          type: String,
          enum: TURNAROUND_OPTIONS,
        },
        analysisDueDate: {
          type: Date,
        },
        // Shared equipment for Air Fungi (and similar air types)
        flowmeter: {
          type: String,
          trim: true,
        },
      },
    ],
    // Analysis header fields per sample type
    analysisMeta: [
      {
        sampleType: {
          type: String,
          enum: SAMPLE_TYPES,
          required: true,
        },
        analyst: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        // Immutable display name captured when analyst is set/updated
        analystName: {
          type: String,
          trim: true,
        },
        analysisDate: {
          type: Date,
        },
        mycometerCertificationNumber: {
          type: String,
          trim: true,
          default: 'MSF-3176-AU',
        },
        standardValue: {
          type: Number,
          default: 535,
        },
        measuredStandardValue: {
          type: Number,
        },
        roomTemperature: {
          type: Number,
        },
        analysisComplete: {
          type: Boolean,
          default: false,
        },
        reportViewedAt: {
          type: Date,
        },
        reportApprovedBy: {
          type: String,
          trim: true,
        },
        reportIssueDate: {
          type: Date,
        },
        reportReference: {
          type: String,
          trim: true,
        },
        revision: {
          type: Number,
          default: 0,
        },
        authorisationRequestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        authorisationRequestedByEmail: {
          type: String,
          trim: true,
        },
      },
    ],
    samples: [
      {
        sampleType: {
          type: String,
          enum: SAMPLE_TYPES,
          required: true,
        },
        sampleId: {
          type: String,
          trim: true,
          default: '',
        },
        sampleLocation: {
          type: String,
          trim: true,
          default: '',
        },
        cleaningStage: {
          type: String,
          enum: CLEANING_STAGES,
        },
        // Shared air sample field (Air Fungi / Air Allergen)
        flowRate: {
          type: Number,
        },
        // Air Fungi only (not used for Air Allergen)
        qualityControl: {
          type: String,
          enum: YES_NO_OPTIONS,
        },
        blankValue: {
          type: Number,
        },
        analysisValue: {
          type: Number,
        },
      },
    ],
    status: {
      type: String,
      enum: ['In Progress', 'Completed'],
      default: 'In Progress',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

mycometerJobSchema.index({ projectId: 1 });
mycometerJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MycometerJob', mycometerJobSchema);
module.exports.SAMPLE_TYPES = SAMPLE_TYPES;
module.exports.CLEANING_STAGES = CLEANING_STAGES;
module.exports.YES_NO_OPTIONS = YES_NO_OPTIONS;
module.exports.TURNAROUND_OPTIONS = TURNAROUND_OPTIONS;
