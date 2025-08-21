const mongoose = require('mongoose');

const AssessmentItemSchema = new mongoose.Schema({
  itemNumber: { type: Number, required: true },
  sampleReference: { type: String, required: true },
  locationDescription: { type: String, required: true },
  levelFloor: { type: String, required: false },
  roomArea: { type: String, required: false },
  materialType: { type: String, required: true },
  asbestosContent: { type: String, required: false },
  asbestosType: { type: String, required: true },
  condition: { type: String, required: true },
  risk: { type: String, required: true },
  photograph: { type: String },
  recommendationActions: { type: String },
  readyForAnalysis: { type: Boolean, default: false },
  
  // Embedded Analysis Data for Fibre ID Analysis
  analysisData: {
    microscope: { type: String, default: "LD-PLM-1" },
    sampleDescription: { type: String },
    sampleType: { type: String, enum: ["mass", "dimensions"], default: "mass" },
    sampleMass: { type: String },
    sampleDimensions: {
      x: { type: String },
      y: { type: String },
      z: { type: String }
    },
    ashing: { type: String, enum: ["yes", "no"], default: "no" },
    crucibleNo: { type: String },
    fibres: [{
      id: { type: Number },
      name: { type: String },
      morphology: { type: String },
      disintegrates: { type: String },
      riLiquid: { type: String },
      colour: { type: String },
      pleochrism: { type: String },
      birefringence: { type: String },
      extinction: { type: String },
      signOfElongation: { type: String },
      fibreParallel: { type: String },
      fibrePerpendicular: { type: String },
      result: { type: String }
    }],
    finalResult: { type: String },
    analyzedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    analyzedAt: { type: Date },
    isAnalyzed: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const AsbestosAssessmentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assessmentDate: { type: Date, required: true },
  status: { 
    type: String, 
    default: 'in-progress',
    enum: ['in-progress', 'samples-with-lab', 'sample-analysis-complete', 'report-ready-for-review', 'complete']
  },
  items: [AssessmentItemSchema],
  analysisCertificate: { type: Boolean, default: false },
  analysisCertificateFile: { type: String },
  sitePlan: { type: Boolean, default: false },
  sitePlanFile: { type: String },
  fibreAnalysisReport: { type: String }, // Base64 PDF data for fibre analysis report
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AsbestosAssessment', AsbestosAssessmentSchema); 