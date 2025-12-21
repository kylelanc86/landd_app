const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceID: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false // Make projectId optional for all invoices
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
  // Line items for the invoice
  lineItems: [{
    itemNo: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: true
    },
    account: {
      type: String,
      default: '191 - Consulting Fees'
    },
    taxRate: {
      type: String,
      default: 'GST on Income'
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    amount: {
      type: Number,
      required: true
    }
  }],
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

// Middleware removed - filtering is handled in API routes

// Add a method to include deleted invoices when needed
invoiceSchema.statics.findIncludingDeleted = function() {
  return this.find({});
};

invoiceSchema.statics.findOneIncludingDeleted = function(conditions) {
  return this.findOne(conditions);
};

// Create indexes for performance
invoiceSchema.index({ status: 1 }); // Index for filtering by status
invoiceSchema.index({ isDeleted: 1 }); // Index for filtering deleted invoices
invoiceSchema.index({ createdAt: -1 }); // Index for sorting by creation date
invoiceSchema.index({ status: 1, isDeleted: 1, createdAt: -1 }); // Compound index for common query pattern

module.exports = mongoose.model('Invoice', invoiceSchema); 