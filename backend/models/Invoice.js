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
    required: false // Make project optional for all invoices
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: function() {
      return !this.xeroInvoiceId; // Only required if not a Xero invoice
    }
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
    type: String,
    unique: true,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  xeroContactId: {
    type: String
  },
  xeroReference: {
    type: String // Store Xero's reference field for project mapping
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