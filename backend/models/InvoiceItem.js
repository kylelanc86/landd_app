const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  itemNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  account: {
    type: String,
    required: true,
    default: '191 - Consulting Fees'
  },
  taxRate: {
    type: String,
    required: true,
    default: 'GST on Income'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient queries
invoiceItemSchema.index({ itemNo: 1 });
invoiceItemSchema.index({ isActive: 1 });

module.exports = mongoose.model('InvoiceItem', invoiceItemSchema); 