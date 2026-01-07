const mongoose = require('mongoose');

const clientSuppliedJobSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  jobNumber: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['In Progress', 'Analysis Complete', 'Completed'],
    default: 'In Progress'
  },
  jobType: {
    type: String,
    enum: ['Fibre ID', 'Fibre Count'],
    default: 'Fibre ID'
  },
  analyst: {
    type: String,
    trim: true
  },
  analysisDate: {
    type: Date
  },
  sampleCount: {
    type: Number,
    default: 0
  },
  sampleReceiptDate: {
    type: Date,
    required: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
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
  revision: {
    type: Number,
    default: 0
  },
  chainOfCustody: {
    fileName: {
      type: String,
      trim: true
    },
    fileType: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date
    },
    data: {
      type: String
    }
  },
  samples: [{
    labReference: {
      type: String,
      required: true,
      trim: true
    },
    clientReference: {
      type: String,
      required: true,
      trim: true
    },
    cowlNumber: {
      type: String,
      trim: true,
      default: ""
    },
    sampleDescription: {
      type: String,
      trim: true,
      default: ""
    },
    ashingReference: {
      type: String,
      trim: true,
      default: ""
    },
    analysisResult: {
      type: String,
      default: 'Pending'
    },
    analysisData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    analysedBy: {
      type: mongoose.Schema.Types.Mixed,
      ref: 'User'
    },
    analysedAt: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
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
clientSuppliedJobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();

  if (this.jobNumber === null || this.jobNumber === undefined || this.jobNumber === '') {
    this.jobNumber = undefined;
  }

  next();
});

// Create indexes
clientSuppliedJobSchema.index({ projectId: 1 });
clientSuppliedJobSchema.index({ status: 1 });
clientSuppliedJobSchema.index(
  { jobNumber: 1 },
  {
    unique: true,
    name: 'clientSuppliedJob_jobNumber_unique',
    partialFilterExpression: {
      $and: [
        { jobNumber: { $exists: true } },
        { jobNumber: { $type: 'string' } },
        { jobNumber: { $gt: '' } }
      ]
    }
  }
);

module.exports = mongoose.model('ClientSuppliedJob', clientSuppliedJobSchema); 