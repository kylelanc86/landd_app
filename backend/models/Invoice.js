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
    required: false // Make client optional for all invoices
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'unpaid', 'paid', 'awaiting_approval'],
    default: 'draft'
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
  xeroClientName: {
    type: String,
    trim: true
  },
  xeroReference: {
    type: String // Store Xero's reference field for project mapping
  },
  xeroStatus: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED'],
    default: 'DRAFT'
  },
  lastSynced: {
    type: Date
  },
  // Soft delete field - when true, invoice is hidden from the app but not deleted from database
  isDeleted: {
    type: Boolean,
    default: false
  },
  // Optional reason for deletion
  deleteReason: {
    type: String,
    trim: true
  },
  // When the invoice was deleted from the app
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Add middleware to automatically filter out deleted invoices from queries
invoiceSchema.pre('find', function() {
  this.where({ isDeleted: { $ne: true } });
});

invoiceSchema.pre('findOne', function() {
  this.where({ isDeleted: { $ne: true } });
});

invoiceSchema.pre('findById', function() {
  this.where({ isDeleted: { $ne: true } });
});

// Add a method to include deleted invoices when needed
invoiceSchema.statics.findIncludingDeleted = function() {
  return this.find({});
};

invoiceSchema.statics.findOneIncludingDeleted = function(conditions) {
  return this.findOne(conditions);
};

module.exports = mongoose.model('Invoice', invoiceSchema); 