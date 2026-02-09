const mongoose = require('mongoose');

const impartialityRiskSchema = new mongoose.Schema({
  activity: {
    type: String,
    required: true,
    trim: true
  },
  riskToImpartiality: {
    type: String,
    required: true,
    trim: true
  },
  // Risk Assessment
  consequenceRating: {
    type: String,
    required: true,
    enum: ['Severe', 'Major', 'Moderate', 'Minor', 'Insignificant']
  },
  likelihood: {
    type: String,
    required: true,
    enum: ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare']
  },
  riskRating: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Extreme'],
    default: null
  },
  controlsToMitigate: {
    type: String,
    required: true,
    trim: true
  },
  // Residual Risk Assessment
  residualConsequence: {
    type: String,
    required: true,
    enum: ['Severe', 'Major', 'Moderate', 'Minor', 'Insignificant']
  },
  residualLikelihood: {
    type: String,
    required: true,
    enum: ['Almost Certain', 'Likely', 'Possible', 'Unlikely', 'Rare']
  },
  residualRiskRating: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Extreme'],
    default: null
  },
  furtherControlsRequired: {
    type: String,
    default: '',
    trim: true
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

impartialityRiskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

impartialityRiskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ImpartialityRisk', impartialityRiskSchema);
