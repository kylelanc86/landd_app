const mongoose = require('mongoose');

const projectAuditSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  action: {
    type: String,
    enum: ['created', 'status_changed', 'updated'],
    required: true
  },
  field: {
    type: String,
    required: false // For status changes, this will be 'status'
  },
  oldValue: {
    type: String,
    required: false
  },
  newValue: {
    type: String,
    required: false
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
projectAuditSchema.index({ projectId: 1, timestamp: -1 });
projectAuditSchema.index({ changedBy: 1, timestamp: -1 });

module.exports = mongoose.model('ProjectAudit', projectAuditSchema);
