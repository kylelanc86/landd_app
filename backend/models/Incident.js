const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  fileData: { type: String, default: null }
}, { _id: false });

const incidentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['non-conformance', 'incident'],
    required: true
  },
  ref: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  nature: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    required: true
  },
  correctiveActionRequired: {
    type: Boolean,
    default: false
  },
  correctiveAction: { type: String, default: null },
  personResponsible: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  correctiveActionDue: { type: Date, default: null },
  attachments: {
    type: [attachmentSchema],
    default: []
  },
  signedOffBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  signedOffByName: { type: String, default: null },
  signedOffAt: { type: Date, default: null },
  signOffEvidence: { type: String, default: null },
  signOffEvidenceFileName: { type: String, default: null },
  signOffEvidenceFileData: { type: String, default: null },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

incidentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

incidentSchema.index({ date: -1 });
incidentSchema.index({ type: 1 });
incidentSchema.index({ ref: 1 }, { unique: true });

module.exports = mongoose.model('Incident', incidentSchema);
