const mongoose = require('mongoose');

const controlledDocumentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['internal', 'external'],
    required: true
  },
  documentRef: {
    type: String,
    required: true,
    unique: true
  },
  documentTitle: {
    type: String,
    required: true
  },
  documentDescription: {
    type: String,
    required: true
  },
  section: {
    type: String,
    enum: ['HAZMAT', 'Lab Services', 'Occ Hygiene'],
    required: true
  },
  currentRevision: {
    type: Number,
    default: null
  },
  lastReviewDate: {
    type: Date,
    default: null
  },
  hardCopyLocations: [{
    type: String
  }],
  fileName: {
    type: String,
    default: null
  },
  fileData: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  history: [{
    revision: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
    updatedBy: { type: String, default: null }
  }],
  deletedAt: { type: Date, default: null },
  deletedBy: { type: String, default: null }
});

controlledDocumentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

controlledDocumentSchema.index({ type: 1 });
controlledDocumentSchema.index({ documentRef: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
controlledDocumentSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('ControlledDocument', controlledDocumentSchema);
