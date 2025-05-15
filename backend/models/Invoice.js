const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid'],
    default: 'unpaid'
  },
  date: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: false
  },
  // Xero integration fields
  xeroInvoiceId: {
    type: String
  },
  xeroContactId: {
    type: String
  },
  xeroStatus: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED'],
    default: 'DRAFT'
  },
  lastSynced: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema); 