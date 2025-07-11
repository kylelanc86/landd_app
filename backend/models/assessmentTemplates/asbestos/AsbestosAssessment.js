const mongoose = require('mongoose');

const AssessmentItemSchema = new mongoose.Schema({
  itemNumber: { type: Number, required: true },
  sampleReference: { type: String, required: true },
  locationDescription: { type: String, required: true },
  materialType: { type: String, required: true },
  asbestosContent: { type: String, required: true },
  asbestosType: { type: String, required: true },
  condition: { type: String, required: true },
  risk: { type: String, required: true },
  photograph: { type: String },
  recommendationActions: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const AsbestosAssessmentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessmentDate: { type: Date, required: true },
  status: { type: String, default: 'in-progress' },
  items: [AssessmentItemSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AsbestosAssessment', AsbestosAssessmentSchema); 