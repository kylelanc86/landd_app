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
    traceAsbestos: { type: String, enum: ["yes", "no"], default: "no" },
    traceAsbestosContent: { type: String },
    traceCount: { type: String },
    comments: { type: String },
    analysedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    analysedAt: { type: Date },
    isAnalysed: { type: Boolean, default: false }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to handle conditional validation for visually assessed items
AssessmentItemSchema.pre('validate', function(next) {
  const isVisuallyAssessedNonAsbestos = 
    this.asbestosContent === "Visually Assessed as Non-asbestos" ||
    this.asbestosContent === "Visually Assessed as Non-Asbestos";
  const isVisuallyAssessedAsbestos = this.asbestosContent === "Visually Assessed as Asbestos";
  const isVisuallyAssessed = isVisuallyAssessedNonAsbestos || isVisuallyAssessedAsbestos;
  
  // For visually assessed non-asbestos items, these fields are not required
  if (isVisuallyAssessedNonAsbestos) {
    // Allow these fields to be null/empty for visually assessed non-asbestos items
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
  } else if (isVisuallyAssessedAsbestos) {
    // For visually assessed asbestos items, sampleReference is not required, but other fields are
    if (this.sampleReference === "" || this.sampleReference === null || this.sampleReference === undefined) {
      this.sampleReference = null;
    }
    if (!this.asbestosType || this.asbestosType.trim() === "") {
      return next(new Error('Asbestos Type is required for visually assessed asbestos items'));
    }
    if (!this.condition || this.condition.trim() === "") {
      return next(new Error('Condition is required for visually assessed asbestos items'));
    }
    if (!this.risk || this.risk.trim() === "") {
      return next(new Error('Risk is required for visually assessed asbestos items'));
    }
  } else {
    // For regular ACM items (with sample reference), all fields are required
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
  // Distinguishes standard asbestos assessments from residential asbestos assessments (separate job lists and flows)
  jobType: {
    type: String,
    enum: ['asbestos-assessment', 'residential-asbestos'],
    default: 'asbestos-assessment',
  },
  LAA: { type: String }, // Licensed Asbestos Assessor name
  state: { type: String, enum: ['ACT', 'NSW', 'Commonwealth'] }, // State (ACT, NSW or Commonwealth)
  secondaryHeader: { type: String }, // Optional secondary header beneath project site name on cover page
  intrusiveness: { type: String, enum: ['non-intrusive', 'intrusive'], default: 'non-intrusive' }, // Residential: Non-intrusive (default) or Intrusive – affects PDF report
  assessmentDate: { type: Date, required: true },
  status: { 
    type: String, 
    default: 'in-progress',
    enum: ['in-progress', 'site-works-complete', 'samples-with-lab', 'sample-analysis-complete', 'report-ready-for-review', 'complete']
  },
  samplesReceivedDate: { type: Date }, // Date when samples were submitted to lab (set when "Submit samples to lab" modal is confirmed)
  submittedBy: { type: String }, // Name of person who submitted samples to lab
  samplesSubmittedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who submitted samples (for notification when analysis complete)
  turnaroundTime: { type: String }, // Turnaround time for analysis (e.g., "3 day", "24 hours", or custom value)
  analysisDueDate: { type: Date }, // Date and time when analysis is due (calculated from turnaround time)
  labSamplesStatus: { type: String, enum: ['samples-in-lab', 'analysis-complete'] }, // L&D supplied jobs table status only (independent of assessment workflow status)
  noSamplesCollected: { type: Boolean, default: false }, // When true, assessment was finalised without sending samples to lab (visual inspection only)
  analyst: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Analyst for all samples in this assessment
  items: [AssessmentItemSchema],
  assessmentScope: [{ type: String }], // Array of scope items for the assessment
  jobSpecificExclusions: { type: String }, // Job-specific exclusions/caveats for the assessment report
  discussionConclusions: { type: String }, // Discussion and conclusions text for the assessment report
  analysisCertificate: { type: Boolean, default: false },
  analysisCertificateFile: { type: String },
  sitePlan: { type: Boolean, default: false },
  sitePlanFile: { type: String }, // Will store the file path or base64 data
  sitePlanSource: {
    type: String,
    enum: ["uploaded", "drawn"],
  },
  sitePlanLegend: [
    {
      color: {
        type: String,
      },
      description: {
        type: String,
      },
    },
  ],
  sitePlanLegendTitle: {
    type: String,
  },
  sitePlanFigureTitle: {
    type: String,
  },
  fibreAnalysisReport: { type: String }, // Base64 PDF data for fibre analysis report
  reportApprovedBy: { type: String }, // Fibre ID report approval (lab analyst)
  reportIssueDate: { type: Date }, // Date when report was issued/approved
  reportAuthorisedBy: { type: String }, // Assessment report authorisation (final sign-off) - distinct from reportApprovedBy
  reportAuthorisedAt: { type: Date }, // Date when report was authorised
  authorisationRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who requested authorisation (send-for-authorisation)
  reportViewedAt: { type: Date }, // When Fibre ID report was viewed (L&D Supplied Jobs – used to show Authorise / Send for Authorisation)
  archived: { type: Boolean, default: false }, // When true, job is removed from the assessment table (completed)
  revision: { type: Number, default: 0 }, // Report revision number
  // Legislation snapshot at job creation (state-specific, from report template); used for {LEGISLATION} in PDFs
  legislation: [{
    _id: String,
    text: String,
    legislationTitle: String,
    jurisdiction: String,
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AsbestosAssessment', AsbestosAssessmentSchema); 