const mongoose = require('mongoose');

const AssessmentItemSchema = new mongoose.Schema({
  // itemNumber is optional initially - it will be added later in the process
  // for items that are confirmed to contain asbestos
  itemNumber: { type: Number, required: false },
  sampleReference: { type: String, required: false },
  locationDescription: { type: String, required: true },
  levelFloor: { type: String, required: false },
  roomArea: { type: String, required: false },
  materialType: { type: String, required: true },
  asbestosContent: { type: String, required: false },
  asbestosType: { type: String, required: false },
  condition: { type: String, required: false },
  risk: { type: String, required: false },
  photograph: { type: String },
  photographs: [{
    data: {
      type: String, // Base64 image data
      required: true,
    },
    includeInReport: {
      type: Boolean,
      default: true, // By default, include photos in report
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    photoNumber: {
      type: Number,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
  }],
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

// Pre-save hook to handle conditional validation for non-ACM items
AssessmentItemSchema.pre('validate', function(next) {
  const isNonACM = this.asbestosContent === "Visually Assessed as Non-ACM";
  
  // For non-ACM items, these fields are not required
  if (isNonACM) {
    // Allow these fields to be null/empty for non-ACM items
    if (this.sampleReference === "" || this.sampleReference === null || this.sampleReference === undefined) {
      this.sampleReference = null;
    }
    if (this.asbestosType === "" || this.asbestosType === null || this.asbestosType === undefined) {
      this.asbestosType = null;
    }
    if (this.condition === "" || this.condition === null || this.condition === undefined) {
      this.condition = null;
    }
    if (this.risk === "" || this.risk === null || this.risk === undefined) {
      this.risk = null;
    }
  } else {
    // For ACM items, these fields are required
    if (!this.sampleReference || this.sampleReference.trim() === "") {
      return next(new Error('Sample Reference is required for ACM items'));
    }
    if (!this.asbestosType || this.asbestosType.trim() === "") {
      return next(new Error('Asbestos Type is required for ACM items'));
    }
    if (!this.condition || this.condition.trim() === "") {
      return next(new Error('Condition is required for ACM items'));
    }
    if (!this.risk || this.risk.trim() === "") {
      return next(new Error('Risk is required for ACM items'));
    }
  }
  
  next();
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
  assessmentScope: [{ type: String }], // Array of scope items for the assessment
  analysisCertificate: { type: Boolean, default: false },
  analysisCertificateFile: { type: String },
  sitePlan: { type: Boolean, default: false },
  sitePlanFile: { type: String },
  fibreAnalysisReport: { type: String }, // Base64 PDF data for fibre analysis report
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AsbestosAssessment', AsbestosAssessmentSchema); 