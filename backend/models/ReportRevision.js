const mongoose = require('mongoose');

const reportRevisionSchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      required: true,
      index: true,
    },
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reportKey: {
      type: String,
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
    },
    /** Revision number opened by this action (the row the user entered a reason for). */
    revisionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    /** Revision printed on the archived PDF, the version this action replaced. */
    supersededRevision: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
    },
    revisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    revisedAt: {
      type: Date,
      default: Date.now,
    },
    pdfFilename: {
      type: String,
      required: true,
    },
    pdfRelativePath: {
      type: String,
      required: true,
    },
    pdfSize: {
      type: Number,
    },
  },
  { timestamps: true }
);

reportRevisionSchema.index(
  { reportType: 1, reportId: 1, reportKey: 1, revisionNumber: 1 },
  { unique: true }
);

module.exports = mongoose.model('ReportRevision', reportRevisionSchema);
